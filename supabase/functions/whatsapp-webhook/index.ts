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

                // Find existing contact by phone - prioritize the one with the most recent activity
                // This ensures incoming replies go to the operator who most recently dispatched
                const { data: contactsWithPhone } = await supabase
                  .from("contacts")
                  .select("*")
                  .eq("phone", phone)
                  .not("status", "eq", "encerrado") // skip blocked contacts
                  .order("last_message_at", { ascending: false, nullsFirst: true }) // most recent activity first
                  .order("created_at", { ascending: false });

                let existingContact = contactsWithPhone?.[0] || null;

                let contactId: string;
                let contactUserId: string | null = null;

                if (!existingContact) {
                  // Create new contact WITHOUT user_id (will be assigned on first outgoing message)
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
                  contactUserId = existingContact.user_id;
                  console.log(`Using existing contact: ${contactId} (user_id: ${contactUserId})`);

                  // If contact is blocked (encerrado), ignore the incoming message
                  if (existingContact.status === "encerrado") {
                    console.log(`Contact ${contactId} is blocked (encerrado). Ignoring message from ${phone}.`);
                    continue;
                  }
                  
                  // Update contact status and last message + mark as has_whatsapp
                  await supabase
                    .from("contacts")
                    .update({
                      status: "respondido",
                      last_message_at: timestamp.toISOString(),
                      has_whatsapp: true,
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
                      user_id: contactUserId,
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
                    
                    console.log("WhatsApp config found:", !!config, "has token:", !!config?.access_token);
                    
                    if (config?.access_token && message.image?.id) {
                      const accessToken = config.access_token;
                      const mediaId = message.image.id;
                      const mimeType = message.image.mime_type || "image/jpeg";
                      const ext = mimeType.split('/')[1] || 'jpg';
                      const fileName = `${Date.now()}-${mediaId}.${ext}`;
                      
                      // Step 1: Get media download URL from WhatsApp Graph API
                      console.log(`Fetching media URL for ID: ${mediaId}`);
                      const mediaResponse = await fetch(
                        `https://graph.facebook.com/v21.0/${mediaId}`,
                        {
                          headers: { Authorization: `Bearer ${accessToken}` },
                        }
                      );
                      
                      console.log("Media API response status:", mediaResponse.status);
                      
                      let downloadUrl: string | null = null;
                      
                      if (mediaResponse.ok) {
                        const mediaData = await mediaResponse.json();
                        downloadUrl = mediaData.url;
                        console.log("Got media download URL from Graph API");
                      } else {
                        const errorText = await mediaResponse.text();
                        console.error("Media API error:", errorText);
                        // Fallback: try the direct URL from webhook payload
                        if (message.image.url) {
                          downloadUrl = message.image.url;
                          console.log("Using fallback URL from webhook payload");
                        }
                      }
                      
                      if (downloadUrl) {
                        // Step 2: Download the actual image binary
                        console.log("Downloading image from URL...");
                        const imageResponse = await fetch(downloadUrl, {
                          headers: { Authorization: `Bearer ${accessToken}` },
                        });
                        
                        console.log("Image download status:", imageResponse.status);
                        
                        if (imageResponse.ok) {
                          const arrayBuffer = await imageResponse.arrayBuffer();
                          const uint8Array = new Uint8Array(arrayBuffer);
                          console.log(`Image downloaded, size: ${uint8Array.length} bytes`);
                          
                          // Step 3: Upload to Supabase Storage
                          const { data: uploadData, error: uploadError } = await supabase
                            .storage
                            .from("documents")
                            .upload(`images/${fileName}`, uint8Array, {
                              contentType: mimeType,
                              upsert: false,
                            });
                          
                          if (uploadError) {
                            console.error("Storage upload error:", uploadError);
                          } else {
                            const { data: urlData } = supabase.storage
                              .from("documents")
                              .getPublicUrl(`images/${fileName}`);
                            imageUrl = urlData.publicUrl;
                            console.log("Image uploaded successfully, URL:", imageUrl);
                          }
                        } else {
                          const errText = await imageResponse.text();
                          console.error("Image download failed:", errText);
                        }
                      } else {
                        console.error("No download URL available for image");
                      }
                    } else {
                      console.error("Missing config or image ID. Config:", !!config, "Image ID:", message.image?.id);
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

                // Save message - IMPORTANT: include user_id from the contact owner
                const messageInsert: any = {
                  conversation_id: conversationId,
                  contact_id: contactId,
                  user_id: contactUserId,
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

                // Build update payload
                const updatePayload: Record<string, string | null> = { status: statusValue };

                // Capture error details on failed messages
                if (statusValue === "failed" && status.errors && status.errors.length > 0) {
                  const err = status.errors[0];
                  const errorCode = String(err.code || "");
                  const errorTitle = err.title || "";
                  const errorMessage = err.message || err.error_data?.details || "";
                  
                  updatePayload.error_code = errorCode;
                  updatePayload.error_details = errorTitle + (errorMessage ? `: ${errorMessage}` : "");
                  
                  console.log(`Message ${messageId} failed - code: ${errorCode}, title: ${errorTitle}, message: ${errorMessage}`);

                  // Mark contact as no WhatsApp when error 131026 (unregistered number)
                  if (errorCode === "131026") {
                    const recipientPhone = status.recipient_id;
                    if (recipientPhone) {
                      console.log(`Marking ${recipientPhone} as no WhatsApp (error 131026)`);
                      await supabase
                        .from("contacts")
                        .update({ has_whatsapp: false })
                        .eq("phone", recipientPhone);
                    }
                  }
                }

                // Update message status
                await supabase
                  .from("messages")
                  .update(updatePayload)
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
