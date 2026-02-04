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

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const contactId = formData.get("contactId") as string;
    const caption = formData.get("caption") as string | null;

    if (!file || !contactId) {
      return new Response(
        JSON.stringify({ error: "Arquivo e contactId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return new Response(
        JSON.stringify({ error: "Apenas arquivos PDF são permitidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Arquivo muito grande. Máximo 10MB." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${contactId}/${timestamp}-${sanitizedName}`;

    // Upload to storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
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
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    const documentUrl = urlData.publicUrl;

    console.log("Document uploaded successfully:", documentUrl);

    // Now send via WhatsApp
    // Get WhatsApp config
    const { data: config, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          documentUrl,
          error: "WhatsApp não configurado. Documento salvo mas não enviado."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Send document via WhatsApp API
    const whatsappUrl = `https://graph.facebook.com/v18.0/${config.phone_number_id}/messages`;

    const requestBody = {
      messaging_product: "whatsapp",
      to: contact.phone,
      type: "document",
      document: {
        link: documentUrl,
        filename: file.name,
        caption: caption || undefined,
      },
    };

    console.log("Sending document to WhatsApp:", JSON.stringify(requestBody, null, 2));

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
      const errorMessage = result.error?.message || "Erro ao enviar documento";
      return new Response(
        JSON.stringify({ 
          success: false,
          documentUrl,
          error: errorMessage, 
          details: result.error 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create conversation
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
          is_active: true,
          window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      conversation = newConversation;
    }

    // Save message to database
    await supabase.from("messages").insert({
      conversation_id: conversation!.id,
      contact_id: contactId,
      direction: "outgoing",
      message_type: "document",
      content: caption || `[Documento: ${file.name}]`,
      document_url: documentUrl,
      document_name: file.name,
      whatsapp_message_id: result.messages?.[0]?.id,
      status: "sent",
    });

    // Update contact
    await supabase
      .from("contacts")
      .update({
        status: "aguardando",
        last_message_at: new Date().toISOString(),
      })
      .eq("id", contactId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        documentUrl,
        messageId: result.messages?.[0]?.id,
        message: "Documento enviado com sucesso!"
      }),
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
