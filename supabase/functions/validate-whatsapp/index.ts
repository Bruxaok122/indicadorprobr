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
    const { accessToken, wabaId, phoneNumberId } = await req.json();

    if (!accessToken || !wabaId || !phoneNumberId) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Todos os campos são obrigatórios: Access Token, WABA ID e Phone Number ID" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate by fetching phone number info
    const phoneUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}`;
    
    console.log("Validating WhatsApp configuration...");
    console.log("Phone Number ID:", phoneNumberId);

    const phoneResponse = await fetch(phoneUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    const phoneResult = await phoneResponse.json();
    console.log("Phone validation result:", JSON.stringify(phoneResult, null, 2));

    if (!phoneResponse.ok) {
      let errorMessage = "Erro desconhecido";
      
      if (phoneResult.error) {
        const code = phoneResult.error.code;
        const message = phoneResult.error.message;

        if (code === 190) {
          errorMessage = "Access Token inválido ou expirado. Gere um novo token no Meta Developers.";
        } else if (code === 100) {
          errorMessage = "Phone Number ID inválido. Verifique o ID no Meta Developers.";
        } else if (code === 10) {
          errorMessage = "Permissão negada. Verifique as permissões do app no Meta Developers.";
        } else if (code === 4) {
          errorMessage = "Limite de requisições atingido. Aguarde alguns minutos.";
        } else if (message.includes("not live")) {
          errorMessage = "O app ainda não está em modo Live. Configure no Meta Developers.";
        } else {
          errorMessage = message || "Erro de validação. Verifique os dados informados.";
        }
      }

      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: errorMessage,
          details: phoneResult.error
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also validate WABA
    const wabaUrl = `https://graph.facebook.com/v18.0/${wabaId}`;
    const wabaResponse = await fetch(wabaUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    const wabaResult = await wabaResponse.json();
    console.log("WABA validation result:", JSON.stringify(wabaResult, null, 2));

    if (!wabaResponse.ok) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "WABA ID inválido. Verifique o ID da conta WhatsApp Business.",
          details: wabaResult.error
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save config to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete existing config and insert new one
    await supabase.from("whatsapp_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { error: insertError } = await supabase.from("whatsapp_config").insert({
      access_token: accessToken,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      is_validated: true,
    });

    if (insertError) {
      console.error("Error saving config:", insertError);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Erro ao salvar configuração no banco de dados." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        valid: true, 
        message: "Conexão validada com sucesso!",
        phoneNumber: phoneResult.display_phone_number,
        businessName: wabaResult.name
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: "Erro de conexão. Verifique sua internet e tente novamente." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
