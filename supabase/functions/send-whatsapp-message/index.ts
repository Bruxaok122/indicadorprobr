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

    const { contactId, message, templateName, isTemplate, userId, selectedPhoneNumberId, replyToMessageId } = await req.json();

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

      const { data: requesterIsAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
      
      if (requesterIsAdmin || userProfile?.can_use_shared_api) {
        // User has permission, use shared config
        const { data: sharedConfig } = await supabase
          .from("api_configs")
          .select("*")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
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
        .from("api_configs")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
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
    // Regra crítica: quando o contato já tem número de disparo vinculado,
    // TODAS as respostas devem sair por esse mesmo número para manter a janela correta.
    let finalPhoneNumberId = config.phone_number_id;

    if (contact.dispatched_phone_number_id) {
      finalPhoneNumberId = contact.dispatched_phone_number_id;

      const { data: phoneWithApi } = await supabase
        .from("waba_phone_numbers")
        .select("api_config_id, is_active")
        .eq("phone_number_id", contact.dispatched_phone_number_id)
        .maybeSingle();

      if (phoneWithApi && !phoneWithApi.is_active) {
        return new Response(
          JSON.stringify({
            error: "O número original deste atendimento está inativo. Reative o número para responder este cliente sem quebrar a janela de conversa.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Número não cadastrado localmente (ex.: conversa iniciada pelo cliente em
      // uma linha ainda não sincronizada): segue com o token da API ativa.
      if (phoneWithApi?.api_config_id) {
        const { data: apiConfig } = await supabase
          .from("api_configs")
          .select("access_token")
          .eq("id", phoneWithApi.api_config_id)
          .eq("is_active", true)
          .maybeSingle();

        if (apiConfig?.access_token) {
          config = { ...config, access_token: apiConfig.access_token };
        }
      }
    } else if (selectedPhoneNumberId) {

      // Sem vínculo prévio, permite seleção manual no primeiro envio
      const { data: phoneRecord } = await supabase
        .from("waba_phone_numbers")
        .select("id, api_config_id")
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

      if (phoneRecord.api_config_id) {
        const { data: apiConfig } = await supabase
          .from("api_configs")
          .select("access_token, waba_id")
          .eq("id", phoneRecord.api_config_id)
          .eq("is_active", true)
          .single();

        if (apiConfig?.access_token) {
          config = { ...config, access_token: apiConfig.access_token, waba_id: apiConfig.waba_id || (config as any).waba_id };
        }
      }
    }

    // Build WhatsApp API request
    const whatsappUrl = `https://graph.facebook.com/v18.0/${finalPhoneNumberId}/messages`;

    let requestBody: any;
    let renderedTemplateBody = "";

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

      // Fetch template body so we save the actual message text (not a [Template: ...] placeholder)
      try {
        if ((config as any).waba_id) {
          const tplRes = await fetch(
            `https://graph.facebook.com/v18.0/${(config as any).waba_id}/message_templates?name=${encodeURIComponent(templateName)}&limit=10`,
            { headers: { Authorization: `Bearer ${config.access_token}` } }
          );
          const tplJson = await tplRes.json();
          const match =
            (tplJson.data || []).find((t: any) => t.name === templateName && t.language === "pt_BR") ||
            (tplJson.data || []).find((t: any) => t.name === templateName) ||
            (tplJson.data || [])[0];
          const bodyComp = match?.components?.find((c: any) => c.type === "BODY");
          renderedTemplateBody = bodyComp?.text || "";
        }
      } catch (e) {
        console.error("Failed to fetch template body for rendering:", e);
      }
    } else {
      requestBody = {
        messaging_product: "whatsapp",
        to: contact.phone,
        type: "text",
        text: { body: message },
      };
    }

    // Inject WhatsApp reply context if replying to a previous message
    let resolvedReplyParentId: string | null = null;
    if (replyToMessageId) {
      const { data: parent } = await supabase
        .from("messages")
        .select("id, whatsapp_message_id")
        .eq("id", replyToMessageId)
        .maybeSingle();
      if (parent?.whatsapp_message_id) {
        resolvedReplyParentId = parent.id;
        requestBody.context = { message_id: parent.whatsapp_message_id };
      }
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
          content: message || renderedTemplateBody || `[Template: ${templateName}]`,
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
      content: message || renderedTemplateBody || `[Template: ${templateName}]`,
      template_name: templateName || null,
      whatsapp_message_id: result.messages?.[0]?.id,
      status: "sent",
      reply_to_message_id: resolvedReplyParentId,
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
