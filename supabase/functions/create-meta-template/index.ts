import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Extract variable placeholders like {{1}}, {{2}} from text
function extractVariables(text: string): number[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => parseInt(m.replace(/[{}]/g, ""))))].sort((a, b) => a - b);
}

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

    const validName = /^[a-z0-9_]+$/.test(name);
    if (!validName) {
      return new Response(
        JSON.stringify({ error: "O nome do template deve conter apenas letras minúsculas, números e underscores (_)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: config, error: configError } = await supabase
      .from("api_configs")
      .select("waba_id, access_token")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !config || !config.waba_id || !config.access_token) {
      return new Response(
        JSON.stringify({ error: "Nenhuma API ativa configurada. Ative uma API antes de criar templates." }),
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

    const components: any[] = [];

    if (headerText) {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: headerText,
      });
    }

    // Detect variables in body and add example if needed
    const bodyVariables = extractVariables(bodyText);
    const bodyComponent: any = {
      type: "BODY",
      text: bodyText,
    };

    if (bodyVariables.length > 0) {
      // Meta requires example values for templates with variables
      const exampleValues = bodyVariables.map((v) => `exemplo_${v}`);
      bodyComponent.example = {
        body_text: [exampleValues],
      };
    }

    components.push(bodyComponent);

    const wabaId = await resolveUsableWabaId(config.waba_id, config.access_token);
    const metaUrl = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;

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
