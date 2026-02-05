import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERIFY_TOKEN = "juriszap_webhook";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Webhook verification (GET request from Meta)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("Webhook verification request:", { mode, token, challenge });

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully!");
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    } else {
      console.log("Webhook verification failed - invalid token");
      return new Response("Forbidden", {
        status: 403,
        headers: corsHeaders,
      });
    }
  }

  // Handle incoming messages (POST request from Meta)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Received webhook payload:", JSON.stringify(body, null, 2));

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Process incoming messages
      if (body.entry) {
        for (const entry of body.entry) {
          const changes = entry.changes || [];
          
          for (const change of changes) {
            if (change.field === "messages") {
              const value = change.value;
              const messages = value.messages || [];
              const contacts = value.contacts || [];

              for (const message of messages) {
                const phone = message.from;
                const messageId = message.id;
                const timestamp = new Date(parseInt(message.timestamp) * 1000);

                // Get contact name from webhook
                const contactInfo = contacts.find((c: any) => c.wa_id === phone);
                const contactName = contactInfo?.profile?.name || "Desconhecido";

                console.log(`Processing message from ${phone}: ${message.type}`);

                // Find existing contact by phone (prioritize ones with user_id set)
                let { data: existingContact } = await supabase
                  .from("contacts")
                  .select("*")
                  .eq("phone", phone)
                  .not("user_id", "is", null)
                  .order("created_at", { ascending: true })
                  .limit(1)
                  .single();

                // If no contact with user_id, check for any contact with this phone
                if (!existingContact) {
                  const { data: anyContact } = await supabase
                    .from("contacts")
                    .select("*")
                    .eq("phone", phone)
                    .order("created_at", { ascending: true })
                    .limit(1)
                    .single();
                  
                  existingContact = anyContact;
                }

                let contactId: string;

                if (!existingContact) {
                  // Create new contact
                  const { data: newContact, error: contactError } = await supabase
                    .from("contacts")
                    .insert({
                      name: contactName,
                      phone: phone,
                      status: "respondido",
                      last_message_at: timestamp.toISOString(),
                    })
                    .select()
                    .single();

                  if (contactError) {
                    console.error("Error creating contact:", contactError);
                    continue;
                  }
                  contactId = newContact.id;
                  console.log(`Created new contact: ${contactId}`);
                } else {
                  contactId = existingContact.id;
                  console.log(`Using existing contact: ${contactId} (user_id: ${existingContact.user_id})`);
                  // Update contact status and last message
                  await supabase
                    .from("contacts")
                    .update({
                      status: "respondido",
                      last_message_at: timestamp.toISOString(),
                    })
                    .eq("id", contactId);
                }

                // Find or create conversation for this specific contact
                let { data: conversation } = await supabase
                  .from("conversations")
                  .select("*")
                  .eq("contact_id", contactId)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .single();

                let conversationId: string;

                if (!conversation || !conversation.is_active) {
                  // Create new conversation if none exists or the existing one is inactive
                  const { data: newConversation, error: convError } = await supabase
                    .from("conversations")
                    .insert({
                      contact_id: contactId,
                      user_id: existingContact?.user_id || null,
                      is_active: true,
                      window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    })
                    .select()
                    .single();

                  if (convError) {
                    console.error("Error creating conversation:", convError);
                    continue;
                  }
                  conversationId = newConversation.id;
                } else {
                  conversationId = conversation.id;
                  // Extend window on response
                  await supabase
                    .from("conversations")
                    .update({
                      window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    })
                    .eq("id", conversationId);
                }

                // Extract message content based on type
                let content = "";
                let messageType = "text";
                let imageUrl: string | undefined;

                if (message.type === "text") {
                  content = message.text?.body || "";
                } else if (message.type === "image") {
                  messageType = "image";
                  content = message.image?.caption || "[Imagem recebida]";
                  
                  // Try to download the image
                  try {
                    // Get WhatsApp config for access token
                    const { data: config } = await supabase
                      .from("whatsapp_config")
                      .select("access_token")
                      .limit(1)
                      .single();
                    
                    if (config?.access_token && message.image?.id) {
                      // Get media URL from WhatsApp
                      const mediaResponse = await fetch(
                        `https://graph.facebook.com/v18.0/${message.image.id}`,
                        {
                          headers: {
                            Authorization: `Bearer ${config.access_token}`,
                          },
                        }
                      );
                      
                      if (mediaResponse.ok) {
                        const mediaData = await mediaResponse.json();
                        
                        // Download the actual image
                        const imageResponse = await fetch(mediaData.url, {
                          headers: {
                            Authorization: `Bearer ${config.access_token}`,
                          },
                        });
                        
                        if (imageResponse.ok) {
                          const imageBlob = await imageResponse.blob();
                          const fileName = `${Date.now()}-${message.image.id}.${mediaData.mime_type?.split('/')[1] || 'jpg'}`;
                          
                          // Upload to Supabase Storage
                          const { data: uploadData, error: uploadError } = await supabase
                            .storage
                            .from("documents")
                            .upload(`images/${fileName}`, imageBlob, {
                              contentType: mediaData.mime_type || "image/jpeg",
                            });
                          
                          if (!uploadError && uploadData) {
                            const { data: urlData } = supabase.storage
                              .from("documents")
                              .getPublicUrl(`images/${fileName}`);
                            imageUrl = urlData.publicUrl;
                          }
                        }
                      }
                    }
                  } catch (imgError) {
                    console.error("Error downloading image:", imgError);
                  }
                } else if (message.type === "document") {
                  content = `[Documento: ${message.document?.filename || "arquivo"}]`;
                  messageType = "document";
                } else if (message.type === "audio") {
                  content = "[Áudio recebido]";
                } else if (message.type === "video") {
                  content = "[Vídeo recebido]";
                } else {
                  content = `[${message.type}]`;
                }

                // Save message
                const messageInsert: any = {
                  conversation_id: conversationId,
                  contact_id: contactId,
                  direction: "incoming",
                  message_type: messageType,
                  content: content,
                  whatsapp_message_id: messageId,
                  status: "delivered",
                };
                
                if (imageUrl) {
                  messageInsert.image_url = imageUrl;
                }

                const { error: messageError } = await supabase.from("messages").insert(messageInsert);

                if (messageError) {
                  console.error("Error saving message:", messageError);
                }

                console.log(`Message saved successfully from ${phone}`);
              }

              // Process status updates
              const statuses = value.statuses || [];
              for (const status of statuses) {
                const messageId = status.id;
                const statusValue = status.status;

                console.log(`Status update for message ${messageId}: ${statusValue}`);

                // Update message status
                await supabase
                  .from("messages")
                  .update({ status: statusValue })
                  .eq("whatsapp_message_id", messageId);
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: unknown) {
      console.error("Webhook error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeaders,
  });
});
