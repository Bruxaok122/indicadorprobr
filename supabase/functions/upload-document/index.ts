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

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const contactId = formData.get("contactId") as string;
    const caption = formData.get("caption") as string | null;
    const selectedPhoneNumberId = formData.get("selectedPhoneNumberId") as string | null;

    if (!file || !contactId) {
      return new Response(
        JSON.stringify({ error: "Arquivo e contactId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";

    if (!isImage && !isPdf) {
      return new Response(
        JSON.stringify({ error: "Apenas PDF e imagens são permitidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maxSize = isImage ? 16 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: `Arquivo muito grande. Máximo ${isImage ? "16" : "10"}MB.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${contactId}/${timestamp}-${sanitizedName}`;

    // Upload to storage
    const fileBuffer = await file.arrayBuffer();
    // Normalize content type for storage compatibility
    let contentType = file.type;
    if (contentType.includes(";")) contentType = contentType.split(";")[0];

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Erro ao fazer upload do arquivo", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fileName);
    const documentUrl = urlData.publicUrl;
    console.log("File uploaded successfully:", documentUrl, "isImage:", isImage);

    // Get contact first — we need dispatched_phone_number_id
    const { data: contact, error: contactError } = await supabase
      .from("contacts").select("*").eq("id", contactId).single();

    if (contactError || !contact) {
      return new Response(
        JSON.stringify({ error: "Contato não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const effectiveUserId = contact.user_id || null;

    // Determine which phone to use — prioritize dispatched_phone_number_id
    let phoneNumberId: string | null = null;
    let accessToken: string | null = null;

    if (contact.dispatched_phone_number_id) {
      // Always reply from the same number used for dispatch
      phoneNumberId = contact.dispatched_phone_number_id;
      const { data: phoneWithApi } = await supabase
        .from("waba_phone_numbers")
        .select("api_config_id, is_active")
        .eq("phone_number_id", contact.dispatched_phone_number_id)
        .maybeSingle();

      if (phoneWithApi?.is_active && phoneWithApi.api_config_id) {
        const { data: apiCfg } = await supabase
          .from("api_configs")
          .select("access_token")
          .eq("id", phoneWithApi.api_config_id)
          .single();
        if (apiCfg) accessToken = apiCfg.access_token;
      }
      // Fallback to shared config token
      if (!accessToken) {
        const { data: sharedCfg } = await supabase.from("whatsapp_config").select("access_token").limit(1).single();
        accessToken = sharedCfg?.access_token || null;
      }
    } else if (selectedPhoneNumberId) {
      phoneNumberId = selectedPhoneNumberId;
      const { data: phoneWithApi } = await supabase
        .from("waba_phone_numbers")
        .select("api_config_id, is_active")
        .eq("phone_number_id", selectedPhoneNumberId)
        .maybeSingle();

      if (phoneWithApi?.is_active && phoneWithApi.api_config_id) {
        const { data: apiCfg } = await supabase
          .from("api_configs")
          .select("access_token")
          .eq("id", phoneWithApi.api_config_id)
          .single();
        if (apiCfg) accessToken = apiCfg.access_token;
      }
      if (!accessToken) {
        const { data: sharedCfg } = await supabase.from("whatsapp_config").select("access_token").limit(1).single();
        accessToken = sharedCfg?.access_token || null;
      }
    }

    if (!phoneNumberId || !accessToken) {
      const { data: config } = await supabase.from("whatsapp_config").select("*").limit(1).single();
      if (config) {
        phoneNumberId = config.phone_number_id;
        accessToken = config.access_token;
      }
    }

    if (!phoneNumberId || !accessToken) {
      return new Response(
        JSON.stringify({ success: true, documentUrl, error: "WhatsApp não configurado. Arquivo salvo mas não enviado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build WhatsApp API request based on file type
    const whatsappUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    let requestBody: any;
    if (isImage) {
      requestBody = {
        messaging_product: "whatsapp",
        to: contact.phone,
        type: "image",
        image: {
          link: documentUrl,
          caption: caption || undefined,
        },
      };
    } else {
      requestBody = {
        messaging_product: "whatsapp",
        to: contact.phone,
        type: "document",
        document: {
          link: documentUrl,
          filename: file.name,
          caption: caption || undefined,
        },
      };
    }

    console.log("Sending file to WhatsApp:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(whatsappUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log("WhatsApp API response:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      const errorMessage = result.error?.message || "Erro ao enviar arquivo";
      return new Response(
        JSON.stringify({ success: false, documentUrl, error: errorMessage, details: result.error }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create conversation
    let { data: conversation } = await supabase
      .from("conversations").select("*").eq("contact_id", contactId).eq("is_active", true).single();

    if (!conversation) {
      const { data: newConversation } = await supabase
        .from("conversations")
        .insert({ contact_id: contactId, user_id: effectiveUserId, is_active: true, window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
        .select().single();
      conversation = newConversation;
    } else if (!conversation.user_id && effectiveUserId) {
      await supabase.from("conversations").update({ user_id: effectiveUserId }).eq("id", conversation.id);
    }

    // Save message to database
    const messageType = isImage ? "image" : "document";
    await supabase.from("messages").insert({
      conversation_id: conversation!.id,
      contact_id: contactId,
      user_id: effectiveUserId,
      direction: "outgoing",
      message_type: messageType,
      content: caption || (isImage ? `[Imagem enviada]` : `[Documento: ${file.name}]`),
      ...(isImage ? { image_url: documentUrl } : { document_url: documentUrl, document_name: file.name }),
      whatsapp_message_id: result.messages?.[0]?.id,
      status: "sent",
    });

    // Update contact
    await supabase.from("contacts").update({
      status: "aguardando",
      last_message_at: new Date().toISOString(),
    }).eq("id", contactId);

    return new Response(
      JSON.stringify({ success: true, documentUrl, messageId: result.messages?.[0]?.id, message: "Arquivo enviado com sucesso!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Upload document error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
