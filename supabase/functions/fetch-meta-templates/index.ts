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

    // Get WhatsApp config
    const { data: config, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado. Configure o Access Token primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.waba_id || !config.access_token) {
      return new Response(
        JSON.stringify({ error: "WABA ID ou Access Token não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch templates from Meta API
    const templatesUrl = `https://graph.facebook.com/v18.0/${config.waba_id}/message_templates?limit=250`;

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
