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

    const { contactId, message, templateName, isTemplate, userId, selectedPhoneNumberId } = await req.json();

    if (!contactId || (!message && !templateName)) {
      return new Response(
        JSON.stringify({ error: "contactId e message ou templateName são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has permission to use shared API
    let config = null;
    
    if (userId) {
      // First check if user can use shared API
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("can_use_shared_api")
        .eq("user_id", userId)
        .single();
      
      if (userProfile?.can_use_shared_api) {
        // User has permission, use shared config
        const { data: sharedConfig } = await supabase
          .from("whatsapp_config")
          .select("*")
          .limit(1)
          .single();
        config = sharedConfig;
      } else {
        // User doesn't have permission, check for personal config
        const { data: userConfig } = await supabase
          .from("user_whatsapp_config")
          .select("*")
          .eq("user_id", userId)
          .eq("is_validated", true)
          .single();
        
        if (userConfig) {
          config = userConfig;
        }
      }
    } else {
      // No userId provided, try shared config (for admin or legacy calls)
      const { data: sharedConfig } = await supabase
        .from("whatsapp_config")
        .select("*")
        .limit(1)
        .single();
      config = sharedConfig;
    }

    if (!config) {
      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado ou você não tem permissão para usar a API compartilhada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (contactError || !contact) {
      return new Response(
        JSON.stringify({ error: "Contato não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block sending to contacts with status "encerrado"
    if (contact.status === "encerrado") {
      return new Response(
        JSON.stringify({ error: "Este cliente está bloqueado. Desbloqueie-o antes de enviar mensagens." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ownership guard: block only when the active/latest record for this phone belongs to another user
    if (userId) {
      // If this exact contact already belongs to another user, block immediately
      if (contact.user_id && contact.user_id !== userId) {
        return new Response(
          JSON.stringify({
            error: "Este contato já foi atendido por outro usuário.",
            code: "CONTACT_ALREADY_CLAIMED"
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Resolve the current owner by latest activity for this phone (ignore closed contacts)
      const { data: latestOwnedForPhone } = await supabase
        .from("contacts")
        .select("id, user_id")
        .eq("phone", contact.phone)
        .neq("status", "encerrado")
        .not("user_id", "is", null)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (
        latestOwnedForPhone &&
        latestOwnedForPhone.user_id !== userId &&
        latestOwnedForPhone.id !== contact.id
      ) {
        return new Response(
          JSON.stringify({
            error: "Este contato já foi atendido por outro usuário.",
            code: "CONTACT_ALREADY_CLAIMED"
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Use the contact's user_id if available, otherwise use the provided userId
    const effectiveUserId = contact.user_id || userId || null;

    // Determine which phone_number_id to use
    let finalPhoneNumberId = config.phone_number_id;

    if (selectedPhoneNumberId) {
      // Validate the selected phone number exists and is active
      const { data: phoneRecord } = await supabase
        .from("waba_phone_numbers")
        .select("id")
        .eq("phone_number_id", selectedPhoneNumberId)
        .eq("is_active", true)
        .single();

      if (!phoneRecord) {
        return new Response(
          JSON.stringify({ error: "Número de disparo inválido ou inativo." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate user permission (unless admin)
      if (effectiveUserId) {
        const { data: isUserAdmin } = await supabase.rpc("is_admin", { _user_id: effectiveUserId });
        if (!isUserAdmin) {
          const { data: permission } = await supabase
            .from("user_phone_permissions")
            .select("id")
            .eq("user_id", effectiveUserId)
            .eq("phone_number_id", phoneRecord.id)
            .maybeSingle();

          if (!permission) {
            return new Response(
              JSON.stringify({ error: "Você não tem permissão para usar este número de disparo." }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      finalPhoneNumberId = selectedPhoneNumberId;
    }

    // Build WhatsApp API request
    const whatsappUrl = `https://graph.facebook.com/v18.0/${finalPhoneNumberId}/messages`;

    let requestBody: any;

    if (isTemplate && templateName) {
      requestBody = {
        messaging_product: "whatsapp",
        to: contact.phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "pt_BR" },
        },
      };
    } else {
      requestBody = {
        messaging_product: "whatsapp",
        to: contact.phone,
        type: "text",
        text: { body: message },
      };
    }

    console.log("Sending message to WhatsApp:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(whatsappUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log("WhatsApp API response:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      const errorMessage = result.error?.message || "Erro ao enviar mensagem";
      const errorCode = String(result.error?.code || response.status);

      // Save failed message to DB so the operator can see why it failed
      let failConversation = null;
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId)
        .eq("is_active", true)
        .single();

      if (existingConv) {
        failConversation = existingConv;
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            contact_id: contactId,
            user_id: effectiveUserId,
            is_active: true,
          })
          .select()
          .single();
        failConversation = newConv;
      }

      if (failConversation) {
        await supabase.from("messages").insert({
          conversation_id: failConversation.id,
          contact_id: contactId,
          user_id: effectiveUserId,
          direction: "outgoing",
          message_type: isTemplate ? "template" : "text",
          content: message || `[Template: ${templateName}]`,
          template_name: templateName || null,
          status: "failed",
          error_code: errorCode,
          error_details: errorMessage,
        });
      }

      return new Response(
        JSON.stringify({ 
          error: errorMessage, 
          details: result.error,
          code: result.error?.code 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create conversation - IMPORTANT: include user_id
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("contact_id", contactId)
      .eq("is_active", true)
      .single();

    if (!conversation) {
      const { data: newConversation } = await supabase
        .from("conversations")
        .insert({
          contact_id: contactId,
          user_id: effectiveUserId,
          is_active: true,
          window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      conversation = newConversation;
    } else if (!conversation.user_id && effectiveUserId) {
      // Update existing conversation with user_id if missing
      await supabase
        .from("conversations")
        .update({ user_id: effectiveUserId })
        .eq("id", conversation.id);
    }

    // Save message to database - IMPORTANT: include user_id
    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: conversation!.id,
      contact_id: contactId,
      user_id: effectiveUserId,
      direction: "outgoing",
      message_type: isTemplate ? "template" : "text",
      content: message || `[Template: ${templateName}]`,
      template_name: templateName || null,
      whatsapp_message_id: result.messages?.[0]?.id,
      status: "sent",
    });

    if (messageError) {
      console.error("Error saving message:", messageError);
    }

    // Update contact status
    await supabase
      .from("contacts")
      .update({
        status: "aguardando",
        last_message_at: new Date().toISOString(),
        dispatched_phone_number_id: finalPhoneNumberId,
      })
      .eq("id", contactId);

    // Update user stats - increment messages_sent or templates_sent
    if (effectiveUserId) {
      if (isTemplate) {
        await supabase.rpc("increment_templates_sent", { _user_id: effectiveUserId });
      } else {
        await supabase.rpc("increment_messages_sent", { _user_id: effectiveUserId });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.messages?.[0]?.id,
        message: "Mensagem enviada com sucesso!"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Send message error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
