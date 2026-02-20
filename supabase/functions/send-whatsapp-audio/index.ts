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

    // Parse multipart form data
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const contactId = formData.get("contactId") as string;
    const userId = formData.get("userId") as string;
    const selectedPhoneNumberId = formData.get("selectedPhoneNumberId") as string | null;

    if (!audioFile || !contactId) {
      return new Response(
        JSON.stringify({ error: "audio e contactId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp config
    let config = null;
    if (userId) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("can_use_shared_api")
        .eq("user_id", userId)
        .single();

      if (userProfile?.can_use_shared_api) {
        const { data: sharedConfig } = await supabase
          .from("whatsapp_config")
          .select("*")
          .limit(1)
          .single();
        config = sharedConfig;
      } else {
        const { data: userConfig } = await supabase
          .from("user_whatsapp_config")
          .select("*")
          .eq("user_id", userId)
          .eq("is_validated", true)
          .single();
        if (userConfig) config = userConfig;
      }
    } else {
      const { data: sharedConfig } = await supabase
        .from("whatsapp_config")
        .select("*")
        .limit(1)
        .single();
      config = sharedConfig;
    }

    if (!config) {
      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado." }),
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

    if (contact.status === "encerrado") {
      return new Response(
        JSON.stringify({ error: "Este cliente está bloqueado." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const effectiveUserId = contact.user_id || userId || null;

    // Determine phone_number_id to use
    let finalPhoneNumberId = config.phone_number_id;
    if (selectedPhoneNumberId) {
      finalPhoneNumberId = selectedPhoneNumberId;
    }

    // Step 1: Upload audio to WhatsApp Media API
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // Use the actual MIME type of the file — do NOT lie to Meta API.
    // Android is lenient about mismatched MIME vs content, but iOS validates strictly.
    // Supported by Meta: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg (opus only)
    const originalMime = audioFile.type || "audio/mpeg";
    const whatsappMime = originalMime; // keep original — no spoofing

    const mediaFormData = new FormData();
    mediaFormData.append("messaging_product", "whatsapp");
    mediaFormData.append("type", whatsappMime);
    mediaFormData.append(
      "file",
      new Blob([audioBytes], { type: whatsappMime }),
      audioFile.name || "audio.mp3"
    );

    const uploadResponse = await fetch(
      `https://graph.facebook.com/v18.0/${finalPhoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
        },
        body: mediaFormData,
      }
    );

    const uploadResult = await uploadResponse.json();
    console.log("Media upload result:", JSON.stringify(uploadResult));

    if (!uploadResponse.ok || !uploadResult.id) {
      const errorMsg = uploadResult.error?.message || "Erro ao fazer upload do áudio";
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mediaId = uploadResult.id;

    // Step 2: Send as PTT (voice note) — this shows as a recorded voice message on iOS too
    const whatsappUrl = `https://graph.facebook.com/v18.0/${finalPhoneNumberId}/messages`;

    // The PTT (voice note) appearance on iOS WhatsApp is determined by the file format (OGG/Opus),
    // NOT by any API parameter. The "ptt" field is not accepted by Meta API (Error 100).
    const requestBody = {
      messaging_product: "whatsapp",
      to: contact.phone,
      type: "audio",
      audio: {
        id: mediaId,
      },
    };

    const sendResponse = await fetch(whatsappUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const sendResult = await sendResponse.json();
    console.log("Send audio result:", JSON.stringify(sendResult));

    if (!sendResponse.ok) {
      const errorMsg = sendResult.error?.message || "Erro ao enviar áudio";
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: sendResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store audio in Supabase Storage
    // Use only basic audio MIME types accepted by storage (no codec parameters)
    const fileExt = audioFile.name?.split(".").pop() || "mp3";
    let storageMime = "audio/mpeg"; // safe default
    if (originalMime.includes("ogg")) storageMime = "audio/ogg";
    else if (originalMime.includes("wav")) storageMime = "audio/wav";
    else if (originalMime.includes("mp4") || originalMime.includes("m4a")) storageMime = "audio/mp4";
    else if (originalMime.includes("webm")) storageMime = "audio/webm";
    else if (originalMime.includes("mpeg") || originalMime.includes("mp3")) storageMime = "audio/mpeg";
    const filePath = `audio/${contactId}/${Date.now()}.${fileExt}`;

    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(filePath, new Blob([audioBytes], { type: storageMime }), {
        contentType: storageMime,
        upsert: false,
      });

    let audioPublicUrl: string | null = null;
    if (!storageError) {
      const { data: publicUrlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);
      audioPublicUrl = publicUrlData?.publicUrl || null;
    } else {
      console.error("Storage upload error:", storageError.message);
    }

    // Get or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("contact_id", contactId)
      .eq("is_active", true)
      .maybeSingle();

    if (!conversation) {
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          contact_id: contactId,
          user_id: effectiveUserId,
          is_active: true,
          window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (convError) {
        console.error("Conversation create error:", convError.message);
      } else {
        conversation = newConversation;
      }
    }

    if (!conversation) {
      console.error("No conversation found or created for contact:", contactId);
      return new Response(
        JSON.stringify({ error: "Não foi possível encontrar ou criar a conversa." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save message
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      contact_id: contactId,
      user_id: effectiveUserId,
      direction: "outgoing",
      message_type: "audio",
      content: "[Áudio]",
      document_url: audioPublicUrl,
      document_name: audioFile.name || "Áudio",
      whatsapp_message_id: sendResult.messages?.[0]?.id,
      status: "sent",
    });

    if (msgError) {
      console.error("Message insert error:", msgError.message);
    } else {
      console.log("Message saved successfully for conversation:", conversation.id);
    }

    // Update contact
    await supabase
      .from("contacts")
      .update({
        status: "aguardando",
        last_message_at: new Date().toISOString(),
      })
      .eq("id", contactId);

    if (effectiveUserId) {
      await supabase.rpc("increment_messages_sent", { _user_id: effectiveUserId });
    }

    return new Response(
      JSON.stringify({ success: true, messageId: sendResult.messages?.[0]?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Send audio error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
