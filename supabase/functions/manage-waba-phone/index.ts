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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: roles } = await anonClient.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Get admin's whatsapp config for access token
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: waConfig } = await serviceClient
      .from("whatsapp_config")
      .select("access_token, waba_id")
      .limit(1)
      .single();

    if (!waConfig?.access_token || !waConfig?.waba_id) {
      return new Response(JSON.stringify({ error: "WhatsApp API não configurada. Configure primeiro em Configuração." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = waConfig.access_token;
    const wabaId = waConfig.waba_id;

    if (action === "register") {
      // Register a new phone number to the WABA
      const { cc, phone_number, verified_name, pin } = body;

      const registerRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cc,
            phone_number,
            verified_name,
            pin,
          }),
        }
      );

      const registerData = await registerRes.json();
      if (!registerRes.ok) {
        throw new Error(registerData.error?.message || "Erro ao registrar número");
      }

      return new Response(JSON.stringify({ success: true, data: registerData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "request_code") {
      // Request verification code
      const { phone_number_id, code_method } = body;

      const codeRes = await fetch(
        `https://graph.facebook.com/v21.0/${phone_number_id}/request_code`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code_method: code_method || "SMS",
            language: "pt_BR",
          }),
        }
      );

      const codeData = await codeRes.json();
      if (!codeRes.ok) {
        throw new Error(codeData.error?.message || "Erro ao solicitar código");
      }

      return new Response(JSON.stringify({ success: true, data: codeData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "verify_code") {
      // Verify the code
      const { phone_number_id, code } = body;

      const verifyRes = await fetch(
        `https://graph.facebook.com/v21.0/${phone_number_id}/verify_code`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        }
      );

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error?.message || "Erro ao verificar código");
      }

      return new Response(JSON.stringify({ success: true, data: verifyData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: unknown) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
