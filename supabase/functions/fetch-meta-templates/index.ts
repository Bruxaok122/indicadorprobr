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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Templates must follow the API currently marked active.
    const { data: config, error: configError } = await supabase
      .from("api_configs")
      .select("waba_id, access_token")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Nenhuma API ativa configurada. Ative uma API antes de buscar templates." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.waba_id || !config.access_token) {
      return new Response(
        JSON.stringify({ error: "WABA ID ou Access Token não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    async function resolveUsableWabaId(storedId: string, token: string): Promise<string> {
      const directResponse = await fetch(
        `https://graph.facebook.com/v21.0/${storedId}/phone_numbers?fields=id&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await directResponse.text();
      if (directResponse.ok) return storedId;

      const phoneResponse = await fetch(
        `https://graph.facebook.com/v21.0/${storedId}?fields=whatsapp_business_account{id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const phoneResult = await phoneResponse.json().catch(() => null);
      if (phoneResult?.whatsapp_business_account?.id) return phoneResult.whatsapp_business_account.id;

      const debugResponse = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`
      );
      const debugResult = await debugResponse.json().catch(() => null);
      const scopes = Array.isArray(debugResult?.data?.granular_scopes) ? debugResult.data.granular_scopes : [];
      for (const scope of scopes) {
        if (!String(scope?.scope || "").startsWith("whatsapp_business_")) continue;
        for (const targetId of scope?.target_ids || []) {
          const targetResponse = await fetch(
            `https://graph.facebook.com/v21.0/${targetId}/phone_numbers?fields=id&limit=1`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          await targetResponse.text();
          if (targetResponse.ok) return String(targetId);
        }
      }

      return storedId;
    }

    const wabaId = await resolveUsableWabaId(config.waba_id, config.access_token);

    // Fetch templates from Meta API
    const templatesUrl = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=250`;

    console.log("Fetching templates from Meta API...");

    const response = await fetch(templatesUrl, {
      headers: {
        "Authorization": `Bearer ${config.access_token}`,
      },
    });

    const result = await response.json();
    console.log("Meta API response:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      const errorMessage = result.error?.message || "Erro ao buscar templates";
      return new Response(
        JSON.stringify({ error: errorMessage, details: result.error }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map templates to a simpler format
    const templates = (result.data || []).map((template: any) => ({
      id: template.id,
      name: template.name,
      status: template.status,
      category: template.category,
      language: template.language,
      components: template.components,
    }));

    return new Response(
      JSON.stringify({ 
        success: true, 
        templates,
        total: templates.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Fetch templates error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
