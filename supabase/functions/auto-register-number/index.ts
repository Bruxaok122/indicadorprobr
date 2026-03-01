import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SMS24H_BASE = "http://api.sms24h.org/stubs/handler_api";
const META_API = "https://graph.facebook.com/v21.0";

function log(step: string, detail: string) {
  console.log(`[auto-register] [${step}] ${detail}`);
}

async function sms24hRequest(apiKey: string, params: Record<string, string>): Promise<string> {
  const url = new URL(SMS24H_BASE);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  // SMS24H requires HTTP (not HTTPS) per their docs
  const res = await fetch(url.toString());
  const text = await res.text();
  return text.trim();
}

async function pollForCode(apiKey: string, activationId: string, maxWaitMs: number = 120000): Promise<string> {
  const interval = 5000;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const result = await sms24hRequest(apiKey, {
      action: "getStatus",
      id: activationId,
    });

    log("poll_sms", `Activation ${activationId}: ${result}`);

    if (result.startsWith("STATUS_OK:")) {
      // STATUS_OK:CODE — code received
      return result.split(":")[1];
    }

    if (result === "STATUS_CANCEL") {
      throw new Error("SMS24H: Ativação cancelada pelo serviço");
    }

    // STATUS_WAIT_CODE or STATUS_WAIT_RETRY — keep polling
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error("Tempo esgotado aguardando SMS. O código não chegou em 2 minutos.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const steps: { step: string; status: "ok" | "error" | "skipped"; detail: string }[] = [];

  function addStep(step: string, status: "ok" | "error" | "skipped", detail: string) {
    steps.push({ step, status, detail });
    log(step, `[${status}] ${detail}`);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sms24hApiKey = Deno.env.get("SMS24H_API_KEY");

    if (!sms24hApiKey) {
      return new Response(
        JSON.stringify({ error: "SMS24H_API_KEY não configurada no servidor.", steps }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check — admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado", steps }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado", steps }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: isAdmin } = await serviceClient.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores.", steps }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse optional body params
    let operator = "any";
    let pin = "000000";
    let service = "wa";
    try {
      const body = await req.json();
      if (body.operator) operator = body.operator;
      if (body.pin) pin = body.pin;
      if (body.service) service = body.service;
    } catch {
      // No body or invalid JSON — use defaults
    }

    // Get WhatsApp config (access token + WABA ID)
    const { data: config } = await serviceClient
      .from("whatsapp_config")
      .select("access_token, waba_id")
      .limit(1)
      .single();

    if (!config?.access_token || !config?.waba_id) {
      addStep("config", "error", "WhatsApp API não configurada (access_token ou waba_id ausente)");
      return new Response(
        JSON.stringify({ error: "WhatsApp API não configurada. Configure primeiro.", steps }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    addStep("config", "ok", "WhatsApp API configurada");

    // ===== STEP 1: Check SMS24H balance =====
    const balanceResult = await sms24hRequest(sms24hApiKey, { action: "getBalance" });
    if (balanceResult.startsWith("ACCESS_BALANCE:")) {
      const balance = parseFloat(balanceResult.split(":")[1]);
      addStep("sms24h_saldo", "ok", `Saldo SMS24H: ${balance}`);
      if (balance < 1) {
        addStep("sms24h_saldo", "error", `Saldo insuficiente: ${balance}`);
        return new Response(
          JSON.stringify({ error: `Saldo SMS24H insuficiente: ${balance}`, steps }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      addStep("sms24h_saldo", "error", `Erro ao consultar saldo: ${balanceResult}`);
      return new Response(
        JSON.stringify({ error: `Erro SMS24H saldo: ${balanceResult}`, steps }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 2: Get number from SMS24H =====
    // service=wa (WhatsApp), country=73 (Brazil)
    const getNumberResult = await sms24hRequest(sms24hApiKey, {
      action: "getNumber",
      service,
      operator,
      country: "73",
    });

    if (!getNumberResult.startsWith("ACCESS_NUMBER:")) {
      addStep("sms24h_numero", "error", `Erro ao obter número: ${getNumberResult}`);
      return new Response(
        JSON.stringify({ error: `SMS24H: ${getNumberResult}`, steps }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACCESS_NUMBER:ID:NUMBER
    const parts = getNumberResult.split(":");
    const activationId = parts[1];
    const rawNumber = parts[2]; // e.g. 5511999887766
    addStep("sms24h_numero", "ok", `Número obtido: +${rawNumber} (ID ativação: ${activationId})`);

    // Extract country code and phone number
    const cc = rawNumber.substring(0, 2); // "55" for Brazil
    const phoneNumber = rawNumber.substring(2); // rest

    // ===== STEP 3: Register number on Meta WABA =====
    let metaPhoneNumberId: string;
    try {
      const registerRes = await fetch(`${META_API}/${config.waba_id}/phone_numbers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cc,
          phone_number: phoneNumber,
          verified_name: "Atendimento Jurídico",
          pin,
        }),
      });

      const registerData = await registerRes.json();
      if (!registerRes.ok) {
        const errorMsg = registerData.error?.message || JSON.stringify(registerData);
        addStep("meta_registro", "error", `Erro Meta ao registrar: ${errorMsg}`);
        // Cancel SMS24H activation
        await sms24hRequest(sms24hApiKey, { action: "setStatus", id: activationId, status: "8" });
        addStep("sms24h_cancelamento", "ok", "Ativação SMS24H cancelada após falha no Meta");
        return new Response(
          JSON.stringify({ error: `Meta API: ${errorMsg}`, steps }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      metaPhoneNumberId = registerData.id;
      addStep("meta_registro", "ok", `Número registrado na Meta (ID: ${metaPhoneNumberId})`);
    } catch (err: any) {
      addStep("meta_registro", "error", `Exceção: ${err.message}`);
      await sms24hRequest(sms24hApiKey, { action: "setStatus", id: activationId, status: "8" });
      return new Response(
        JSON.stringify({ error: `Meta API exception: ${err.message}`, steps }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 4: Request SMS verification code from Meta =====
    try {
      const codeRes = await fetch(`${META_API}/${metaPhoneNumberId}/request_code`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code_method: "SMS", language: "pt_BR" }),
      });

      const codeData = await codeRes.json();
      if (!codeRes.ok) {
        const errorMsg = codeData.error?.message || JSON.stringify(codeData);
        addStep("meta_solicitar_codigo", "error", `Erro ao solicitar código SMS: ${errorMsg}`);
        await sms24hRequest(sms24hApiKey, { action: "setStatus", id: activationId, status: "8" });
        return new Response(
          JSON.stringify({ error: `Meta request_code: ${errorMsg}`, steps }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      addStep("meta_solicitar_codigo", "ok", "Código SMS solicitado à Meta com sucesso");
    } catch (err: any) {
      addStep("meta_solicitar_codigo", "error", `Exceção: ${err.message}`);
      await sms24hRequest(sms24hApiKey, { action: "setStatus", id: activationId, status: "8" });
      return new Response(
        JSON.stringify({ error: `Meta request_code exception: ${err.message}`, steps }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Notify SMS24H that SMS was sent (optional but recommended)
    await sms24hRequest(sms24hApiKey, { action: "setStatus", id: activationId, status: "1" });

    // ===== STEP 5: Poll SMS24H for the verification code =====
    let verificationCode: string;
    try {
      verificationCode = await pollForCode(sms24hApiKey, activationId, 120000);
      addStep("sms24h_codigo", "ok", `Código recebido: ${verificationCode}`);
    } catch (err: any) {
      addStep("sms24h_codigo", "error", err.message);
      // Cancel activation
      await sms24hRequest(sms24hApiKey, { action: "setStatus", id: activationId, status: "8" });
      return new Response(
        JSON.stringify({ error: err.message, steps }),
        { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 6: Verify code on Meta =====
    try {
      const verifyRes = await fetch(`${META_API}/${metaPhoneNumberId}/verify_code`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: verificationCode }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        const errorMsg = verifyData.error?.message || JSON.stringify(verifyData);
        addStep("meta_verificar_codigo", "error", `Erro ao verificar código: ${errorMsg}`);
        await sms24hRequest(sms24hApiKey, { action: "setStatus", id: activationId, status: "8" });
        return new Response(
          JSON.stringify({ error: `Meta verify_code: ${errorMsg}`, steps }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      addStep("meta_verificar_codigo", "ok", "Código verificado com sucesso na Meta");
    } catch (err: any) {
      addStep("meta_verificar_codigo", "error", `Exceção: ${err.message}`);
      await sms24hRequest(sms24hApiKey, { action: "setStatus", id: activationId, status: "8" });
      return new Response(
        JSON.stringify({ error: `Meta verify_code exception: ${err.message}`, steps }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 7: Register number (set PIN) on Meta =====
    try {
      const registerRes = await fetch(`${META_API}/${metaPhoneNumberId}/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", pin }),
      });

      const registerData = await registerRes.json();
      if (!registerRes.ok) {
        const errorMsg = registerData.error?.message || JSON.stringify(registerData);
        addStep("meta_registrar_pin", "error", `Erro ao registrar PIN: ${errorMsg}`);
        // Don't cancel sms24h here — code was already used
        return new Response(
          JSON.stringify({ error: `Meta register PIN: ${errorMsg}`, steps }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      addStep("meta_registrar_pin", "ok", "Número registrado com PIN na Meta");
    } catch (err: any) {
      addStep("meta_registrar_pin", "error", `Exceção: ${err.message}`);
      return new Response(
        JSON.stringify({ error: `Meta register exception: ${err.message}`, steps }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 8: Finalize SMS24H activation =====
    const finalizeResult = await sms24hRequest(sms24hApiKey, {
      action: "setStatus",
      id: activationId,
      status: "6",
    });
    addStep("sms24h_finalizar", finalizeResult === "ACCESS_ACTIVATION" ? "ok" : "error",
      `Ativação finalizada: ${finalizeResult}`);

    // ===== STEP 9: Save number to database =====
    try {
      // Get active api_config
      const { data: activeApiConfig } = await serviceClient
        .from("api_configs")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single();

      await serviceClient
        .from("waba_phone_numbers")
        .upsert(
          {
            phone_number_id: metaPhoneNumberId,
            display_phone_number: `+${rawNumber}`,
            verified_name: "Atendimento Jurídico",
            is_active: true,
            created_by: user.id,
            api_config_id: activeApiConfig?.id || null,
          },
          { onConflict: "phone_number_id" }
        );

      addStep("salvar_db", "ok", `Número +${rawNumber} salvo no banco de dados`);
    } catch (err: any) {
      addStep("salvar_db", "error", `Erro ao salvar no DB: ${err.message}. O número foi registrado na Meta com sucesso.`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        phone_number: `+${rawNumber}`,
        phone_number_id: metaPhoneNumberId,
        activation_id: activationId,
        steps,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("auto-register fatal error:", error);
    addStep("fatal", "error", error.message || "Erro desconhecido");
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido", steps }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
