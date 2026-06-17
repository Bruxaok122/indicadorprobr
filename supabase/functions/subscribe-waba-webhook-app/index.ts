import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await anonClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: isAdmin } = await serviceClient.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: activeApiConfig } = await serviceClient
      .from("api_configs")
      .select("id, name, waba_id, phone_number_id, access_token")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const { data: sharedConfig } = await serviceClient
      .from("whatsapp_config")
      .select("waba_id, phone_number_id, access_token")
      .limit(1)
      .maybeSingle();

    const candidates: Array<{ id: string; token: string; label: string }> = [];
    const addCandidate = (id?: string | null, token?: string | null, label?: string) => {
      const cleanId = id?.trim();
      const cleanToken = token?.trim();
      if (!cleanId || !cleanToken) return;
      if (candidates.some((candidate) => candidate.id === cleanId && candidate.token === cleanToken)) return;
      candidates.push({ id: cleanId, token: cleanToken, label: label || cleanId });
    };

    addCandidate(activeApiConfig?.waba_id, activeApiConfig?.access_token, `api_configs:${activeApiConfig?.name || "ativa"}:waba_id`);
    addCandidate(activeApiConfig?.phone_number_id, activeApiConfig?.access_token, `api_configs:${activeApiConfig?.name || "ativa"}:phone_number_id`);
    addCandidate(sharedConfig?.waba_id, sharedConfig?.access_token, "whatsapp_config:waba_id");
    addCandidate(sharedConfig?.phone_number_id, sharedConfig?.access_token, "whatsapp_config:phone_number_id");

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: "Configuração do WhatsApp não encontrada (WABA ID / Access Token)." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Stored configs can be inconsistent after rollbacks: some rows have a phone_number_id in waba_id.
    // Try the active config first, then legacy config, resolving phone_number_id -> WABA when Meta allows it.
    async function resolveWabaId(id: string, token: string): Promise<string | null> {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${id}?fields=whatsapp_business_account{id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const j = await r.json();
      if (!r.ok) console.log("Resolve WABA failed:", JSON.stringify({ id, error: j?.error }, null, 2));
      return j?.whatsapp_business_account?.id ?? null;
    }

    let lastFailure: { status: number; result: any; label: string; id: string } | null = null;

    for (const candidate of candidates) {
      let currentId = candidate.id;
      let subscribeResponse = await fetch(`https://graph.facebook.com/v21.0/${currentId}/subscribed_apps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${candidate.token}` },
      });

      let subscribeResult = await subscribeResponse.json();
      console.log("Subscribe app attempt:", JSON.stringify({ label: candidate.label, id: currentId, result: subscribeResult }, null, 2));

      if (!subscribeResponse.ok) {
        const code = subscribeResult?.error?.code;
        const msg = String(subscribeResult?.error?.message || "");
        if (code === 100 && (msg.includes("subscribed_apps") || msg.includes("nonexisting field") || msg.includes("Unsupported post request"))) {
          const realWaba = await resolveWabaId(currentId, candidate.token);
          if (realWaba && realWaba !== currentId) {
            console.log(`Resolved real WABA id ${realWaba} from ${currentId}`);
            currentId = realWaba;
            subscribeResponse = await fetch(`https://graph.facebook.com/v21.0/${currentId}/subscribed_apps`, {
              method: "POST",
              headers: { Authorization: `Bearer ${candidate.token}` },
            });
            subscribeResult = await subscribeResponse.json();
            console.log("Subscribe app retry:", JSON.stringify({ label: candidate.label, id: currentId, result: subscribeResult }, null, 2));
          }
        }
      }

      if (subscribeResponse.ok) {
        const checkResponse = await fetch(`https://graph.facebook.com/v21.0/${currentId}/subscribed_apps`, {
          headers: { Authorization: `Bearer ${candidate.token}` },
        });

        const checkResult = await checkResponse.json();

        return new Response(
          JSON.stringify({
            success: true,
            subscribeResult,
            subscribedApps: checkResult?.data ?? [],
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      lastFailure = { status: subscribeResponse.status, result: subscribeResult, label: candidate.label, id: currentId };
    }

    if (lastFailure) {
      return new Response(
        JSON.stringify({
          success: false,
          error: lastFailure.result?.error?.message || "Falha ao inscrever app no WABA",
          details: lastFailure.result?.error || null,
          attemptedConfig: { label: lastFailure.label, id: lastFailure.id },
        }),
        {
          status: lastFailure.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: false, error: "Nenhuma configuração válida para inscrição do app." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("subscribe-waba-webhook-app error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
