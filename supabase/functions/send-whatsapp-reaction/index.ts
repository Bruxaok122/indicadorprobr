import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { messageId, emoji, userId } = await req.json();
    if (!messageId) {
      return new Response(JSON.stringify({ error: "messageId obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find target message
    const { data: targetMsg, error: msgErr } = await supabase
      .from("messages")
      .select("id, contact_id, conversation_id, whatsapp_message_id")
      .eq("id", messageId)
      .single();

    if (msgErr || !targetMsg?.whatsapp_message_id) {
      return new Response(JSON.stringify({ error: "Mensagem não encontrada ou sem ID WhatsApp" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve contact + phone routing
    const { data: contact } = await supabase
      .from("contacts")
      .select("phone, dispatched_phone_number_id, user_id")
      .eq("id", targetMsg.contact_id)
      .single();

    if (!contact) {
      return new Response(JSON.stringify({ error: "Contato não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve API config (mirror send-whatsapp-message logic, simplified)
    let accessToken: string | null = null;
    let phoneNumberId: string | null = contact.dispatched_phone_number_id;

    if (phoneNumberId) {
      const { data: phoneRow } = await supabase
        .from("waba_phone_numbers")
        .select("api_config_id")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();
      if (phoneRow?.api_config_id) {
        const { data: apiCfg } = await supabase
          .from("api_configs")
          .select("access_token")
          .eq("id", phoneRow.api_config_id)
          .single();
        accessToken = apiCfg?.access_token || null;
      }
    }

    if (!accessToken || !phoneNumberId) {
      // Fallback to user/shared config
      if (userId) {
        const { data: prof } = await supabase
          .from("profiles").select("can_use_shared_api").eq("user_id", userId).single();
        if (prof?.can_use_shared_api) {
          const { data: shared } = await supabase.from("whatsapp_config").select("*").limit(1).single();
          if (shared) { accessToken = accessToken || shared.access_token; phoneNumberId = phoneNumberId || shared.phone_number_id; }
        } else {
          const { data: own } = await supabase
            .from("user_whatsapp_config").select("*").eq("user_id", userId).eq("is_validated", true).single();
          if (own) { accessToken = accessToken || own.access_token; phoneNumberId = phoneNumberId || own.phone_number_id; }
        }
      }
    }

    if (!accessToken || !phoneNumberId) {
      return new Response(JSON.stringify({ error: "Configuração WhatsApp indisponível" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = {
      messaging_product: "whatsapp",
      to: contact.phone,
      type: "reaction",
      reaction: {
        message_id: targetMsg.whatsapp_message_id,
        emoji: emoji || "",
      },
    };

    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: result?.error?.message || "Falha ao enviar reação", code: result?.error?.code }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const waMsgId = result?.messages?.[0]?.id || null;

    // Persist locally
    await supabase.from("messages").insert({
      conversation_id: targetMsg.conversation_id,
      contact_id: targetMsg.contact_id,
      user_id: contact.user_id || userId || null,
      direction: "outgoing",
      message_type: "reaction",
      content: emoji || "",
      whatsapp_message_id: waMsgId,
      status: "sent",
      reacts_to_message_id: targetMsg.id,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
