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
      .select("waba_id, access_token")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    let wabaId = activeApiConfig?.waba_id ?? null;
    let accessToken = activeApiConfig?.access_token ?? null;

    if (!wabaId || !accessToken) {
      const { data: sharedConfig } = await serviceClient
        .from("whatsapp_config")
        .select("waba_id, access_token")
        .limit(1)
        .maybeSingle();

      wabaId = sharedConfig?.waba_id ?? null;
      accessToken = sharedConfig?.access_token ?? null;
    }

    if (!wabaId || !accessToken) {
      return new Response(
        JSON.stringify({ error: "Configuração do WhatsApp não encontrada (WABA ID / Access Token)." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // The stored "waba_id" may actually be a phone_number_id. Try to subscribe; if Meta complains
    // that phone_numbers/subscribed_apps doesn't exist on that object, resolve the real WABA id.
    async function resolveWabaId(id: string, token: string): Promise<string | null> {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${id}?fields=whatsapp_business_account`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const j = await r.json();
      return j?.whatsapp_business_account?.id ?? null;
    }

    let subscribeResponse = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!subscribeResponse.ok) {
      const cloned = subscribeResponse.clone();
      const errBody = await cloned.json().catch(() => null);
      const code = errBody?.error?.code;
      const msg = String(errBody?.error?.message || "");
      if (code === 100 && (msg.includes("subscribed_apps") || msg.includes("nonexisting field"))) {
        const realWaba = await resolveWabaId(wabaId, accessToken);
        if (realWaba) {
          console.log(`Resolved real WABA id ${realWaba} from ${wabaId}`);
          wabaId = realWaba;
          subscribeResponse = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
      }
    }

    const subscribeResult = await subscribeResponse.json();
    console.log("Subscribe app result:", JSON.stringify(subscribeResult, null, 2));

    if (!subscribeResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: subscribeResult?.error?.message || "Falha ao inscrever app no WABA",
          details: subscribeResult?.error || null,
        }),
        {
          status: subscribeResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const checkResponse = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
      headers: { Authorization: `Bearer ${accessToken}` },
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
