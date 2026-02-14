import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { name, category, language, bodyText, headerText } = await req.json();

    if (!name || !category || !bodyText) {
      return new Response(
        JSON.stringify({ error: "Nome, categoria e texto do corpo são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate template name: lowercase, underscores only
    const validName = /^[a-z0-9_]+$/.test(name);
    if (!validName) {
      return new Response(
        JSON.stringify({ error: "O nome do template deve conter apenas letras minúsculas, números e underscores (_)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp config
    const { data: config, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !config || !config.waba_id || !config.access_token) {
      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado. Configure o Access Token primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build components array
    const components: any[] = [];

    if (headerText) {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: headerText,
      });
    }

    components.push({
      type: "BODY",
      text: bodyText,
    });

    // Submit template to Meta API
    const metaUrl = `https://graph.facebook.com/v18.0/${config.waba_id}/message_templates`;

    const payload = {
      name,
      category: category.toUpperCase(),
      language: language || "pt_BR",
      components,
    };

    console.log("Creating template on Meta:", JSON.stringify(payload));

    const response = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("Meta API response:", JSON.stringify(result));

    if (!response.ok) {
      const errorMessage = result.error?.message || "Erro ao criar template na Meta";
      return new Response(
        JSON.stringify({ error: errorMessage, details: result.error }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Template enviado para análise da Meta com sucesso!",
        template_id: result.id,
        status: result.status || "PENDING",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Create template error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
