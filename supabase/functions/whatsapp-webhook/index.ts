import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VERIFY_TOKEN = "juriszap_webhook";

function getPhoneCandidates(rawPhone: string): string[] {
  const digits = rawPhone.replace(/\D/g, "");
  const candidates = new Set<string>();

  if (!digits) return [];

  candidates.add(digits);

  if (digits.startsWith("55")) {
    const national = digits.slice(2);

    if (national.length === 10) {
      candidates.add(`55${national.slice(0, 2)}9${national.slice(2)}`);
    }

    if (national.length === 11 && national[2] === "9") {
      candidates.add(`55${national.slice(0, 2)}${national.slice(3)}`);
    }
  } else {
    candidates.add(`55${digits}`);

    if (digits.length === 10) {
      candidates.add(`55${digits.slice(0, 2)}9${digits.slice(2)}`);
    }

    if (digits.length === 11 && digits[2] === "9") {
      candidates.add(`55${digits.slice(0, 2)}${digits.slice(3)}`);
    }
  }

  return Array.from(candidates);
}

function getCanonicalPhone(rawPhone: string): string {
  const candidates = getPhoneCandidates(rawPhone);
  return candidates.sort((a, b) => b.length - a.length)[0] ?? rawPhone.replace(/\D/g, "");
}

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
                const phoneCandidates = getPhoneCandidates(phone);
                const canonicalPhone = getCanonicalPhone(phone);
                const messageId = message.id;
                const timestamp = new Date(parseInt(message.timestamp) * 1000);

                // Get contact name from webhook
                const contactInfo = contacts.find((c: any) => c.wa_id === phone);
                const contactName = contactInfo?.profile?.name || "Desconhecido";

                console.log(`Processing message from ${phone}: ${message.type}`);

                // === DEDUP: Skip if we already processed this WhatsApp message ID ===
                const { data: existingMsg } = await supabase
                  .from("messages")
                  .select("id")
                  .eq("whatsapp_message_id", messageId)
                  .limit(1)
                  .maybeSingle();
                if (existingMsg) {
                  console.log(`Skipping duplicate message: ${messageId}`);
                  continue;
                }

                // Check if ANY contact with this phone is blocked (encerrado).
                // If so, ignore the inbound message entirely — never create a new
                // contact and never resurrect into the shared/disponíveis pool.
                const { data: blockedContacts } = await supabase
                  .from("contacts")
                  .select("id")
                  .in("phone", phoneCandidates)
                  .eq("status", "encerrado")
                  .limit(1);

                if (blockedContacts && blockedContacts.length > 0) {
                  console.log(`Phone ${phone} has a blocked contact. Ignoring inbound message.`);
                  continue;
                }

                // Find existing contact by phone - prioritize the one with the most recent activity
                // This ensures incoming replies go to the operator who most recently dispatched
                const { data: contactsWithPhone } = await supabase
                  .from("contacts")
                  .select("*")
                  .in("phone", phoneCandidates)
                  .order("last_message_at", { ascending: false, nullsFirst: false }) // most recent activity first, nulls LAST
                  .order("created_at", { ascending: false });

                let existingContact = contactsWithPhone?.[0] || null;

                let contactId: string;
                let contactUserId: string | null = null;

                if (!existingContact) {
                  // Unknown inbound contact enters the shared pool until someone assumes it
                  const { data: newContact, error: contactError } = await supabase
                    .from("contacts")
                    .insert({
                      name: contactName,
                      phone: canonicalPhone,
                      status: "respondido",
                      dispatch_mode: "shared",
                      last_message_at: timestamp.toISOString(),
                      user_id: null,
                      has_whatsapp: true,
                    })
                    .select()
                    .single();

                  if (contactError) {
                    console.error("Error creating contact:", contactError);
                    continue;
                  }
                  contactId = newContact.id;
                  contactUserId = null;
                  console.log(`Created new shared contact: ${contactId}`);
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
                const messageInsertExtra: Record<string, any> = {};

                // Resolve reply/quote context (when client replies to a previous message)
                // Skip for reaction (uses reacts_to_message_id) and unsupported (deletion handling).
                if (
                  message.context?.id &&
                  message.type !== "reaction" &&
                  message.type !== "unsupported"
                ) {
                  const { data: parentMsg } = await supabase
                    .from("messages")
                    .select("id")
                    .eq("whatsapp_message_id", message.context.id)
                    .maybeSingle();
                  if (parentMsg?.id) {
                    messageInsertExtra.reply_to_message_id = parentMsg.id;
                  }
                }


                // Fetch access token once — used for downloading any media
                let accessToken: string | null = null;
                try {
                  const { data: activeApi } = await supabase
                    .from("api_configs")
                    .select("access_token")
                    .eq("is_active", true)
                    .limit(1)
                    .single();
                  if (activeApi?.access_token) {
                    accessToken = activeApi.access_token;
                  } else {
                    const { data: sharedConfig } = await supabase
                      .from("whatsapp_config")
                      .select("access_token")
                      .limit(1)
                      .single();
                    if (sharedConfig?.access_token) accessToken = sharedConfig.access_token;
                  }
                } catch (_) { /* no config */ }

                if (message.type === "text") {
                  content = message.text?.body || "";
                } else if (message.type === "image") {
                  messageType = "image";
                  content = message.image?.caption || "[Imagem recebida]";
                  
                  try {
                    if (accessToken && message.image?.id) {
                      const mediaId = message.image.id;
                      const mimeType = message.image.mime_type || "image/jpeg";
                      const ext = mimeType.split('/')[1] || 'jpg';
                      const fileName = `${Date.now()}-${mediaId}.${ext}`;
                      
                      console.log(`Fetching media URL for ID: ${mediaId}`);
                      const mediaResponse = await fetch(
                        `https://graph.facebook.com/v21.0/${mediaId}`,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                      );
                      
                      let downloadUrl: string | null = null;
                      if (mediaResponse.ok) {
                        const mediaData = await mediaResponse.json();
                        downloadUrl = mediaData.url;
                      } else {
                        console.error("Media API error:", await mediaResponse.text());
                        if (message.image.url) downloadUrl = message.image.url;
                      }
                      
                      if (downloadUrl) {
                        const imageResponse = await fetch(downloadUrl, {
                          headers: { Authorization: `Bearer ${accessToken}` },
                        });
                        if (imageResponse.ok) {
                          const arrayBuffer = await imageResponse.arrayBuffer();
                          const uint8Array = new Uint8Array(arrayBuffer);
                          const { error: uploadError } = await supabase.storage
                            .from("documents")
                            .upload(`images/${fileName}`, uint8Array, { contentType: mimeType, upsert: false });
                          if (uploadError) {
                            console.error("Storage upload error:", uploadError);
                          } else {
                            const { data: urlData } = supabase.storage.from("documents").getPublicUrl(`images/${fileName}`);
                            imageUrl = urlData.publicUrl;
                            console.log("Image uploaded successfully, URL:", imageUrl);
                          }
                        } else {
                          console.error("Image download failed:", await imageResponse.text());
                        }
                      }
                    } else {
                      console.error("Missing access token or image ID");
                    }
                  } catch (imgError) {
                    console.error("Error downloading image:", imgError);
                  }
                } else if (message.type === "document") {
                  const origFilename = message.document?.filename || "arquivo";
                  content = `[Documento: ${origFilename}]`;
                  messageType = "document";
                  (messageInsertExtra as any).document_name = origFilename;
                  try {
                    if (accessToken && message.document?.id) {
                      const mediaId = message.document.id;
                      const mimeType = message.document.mime_type || "application/octet-stream";
                      // Sanitize: never expose original filename in storage path —
                      // strips any tracker metadata embedded in the name.
                      const extFromName = (origFilename.match(/\.([a-z0-9]{2,5})$/i)?.[1] || "").toLowerCase();
                      const extFromMime = mimeType === "application/pdf" ? "pdf" : (mimeType.split("/")[1] || "bin");
                      const ext = extFromName || extFromMime;
                      const fileName = `${Date.now()}-${mediaId}.${ext}`;

                      const mediaResponse = await fetch(
                        `https://graph.facebook.com/v21.0/${mediaId}`,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                      );
                      let downloadUrl: string | null = null;
                      if (mediaResponse.ok) {
                        const mediaData = await mediaResponse.json();
                        downloadUrl = mediaData.url;
                      } else {
                        console.error("Document media API error:", await mediaResponse.text());
                      }
                      if (downloadUrl) {
                        const docResponse = await fetch(downloadUrl, {
                          headers: { Authorization: `Bearer ${accessToken}` },
                        });
                        if (docResponse.ok) {
                          const arrayBuffer = await docResponse.arrayBuffer();
                          const uint8Array = new Uint8Array(arrayBuffer);
                          const { error: uploadError } = await supabase.storage
                            .from("documents")
                            .upload(`docs/${fileName}`, uint8Array, { contentType: mimeType, upsert: false });
                          if (uploadError) {
                            console.error("Document storage upload error:", uploadError);
                          } else {
                            const { data: urlData } = supabase.storage.from("documents").getPublicUrl(`docs/${fileName}`);
                            (messageInsertExtra as any).document_url = urlData.publicUrl;
                            console.log("Document uploaded successfully");
                          }
                        } else {
                          console.error("Document download failed:", await docResponse.text());
                        }
                      }
                    }
                  } catch (docError) {
                    console.error("Error downloading document:", docError);
                  }
                } else if (message.type === "audio") {
                  content = "[Áudio recebido]";
                  messageType = "audio";
                  try {
                    if (accessToken && message.audio?.id) {
                      const mediaId = message.audio.id;
                      const mimeType = message.audio.mime_type || "audio/ogg";
                      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.split('/')[1] || "ogg";
                      const fileName = `${Date.now()}-${mediaId}.${ext}`;

                      const mediaResponse = await fetch(
                        `https://graph.facebook.com/v21.0/${mediaId}`,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                      );

                      let downloadUrl: string | null = null;
                      if (mediaResponse.ok) {
                        const mediaData = await mediaResponse.json();
                        downloadUrl = mediaData.url;
                      } else {
                        console.error("Audio media API error:", await mediaResponse.text());
                      }

                      if (downloadUrl) {
                        const audioResponse = await fetch(downloadUrl, {
                          headers: { Authorization: `Bearer ${accessToken}` },
                        });
                        if (audioResponse.ok) {
                          const arrayBuffer = await audioResponse.arrayBuffer();
                          const uint8Array = new Uint8Array(arrayBuffer);
                          const { error: uploadError } = await supabase.storage
                            .from("documents")
                            .upload(`audio/${fileName}`, uint8Array, { contentType: mimeType, upsert: false });
                          if (uploadError) {
                            console.error("Audio storage upload error:", uploadError);
                          } else {
                            const { data: urlData } = supabase.storage.from("documents").getPublicUrl(`audio/${fileName}`);
                            imageUrl = urlData.publicUrl;
                            console.log("Audio uploaded successfully, URL:", imageUrl);
                          }
                        } else {
                          console.error("Audio download failed:", await audioResponse.text());
                        }
                      }
                    }
                  } catch (audioError) {
                    console.error("Error downloading audio:", audioError);
                  }
                } else if (message.type === "sticker") {
                  messageType = "sticker";
                  content = "[Figurinha]";
                  try {
                    if (accessToken && message.sticker?.id) {
                      const mediaId = message.sticker.id;
                      const mimeType = message.sticker.mime_type || "image/webp";
                      const ext = mimeType.includes("webp") ? "webp" : (mimeType.split("/")[1] || "webp");
                      const fileName = `${Date.now()}-${mediaId}.${ext}`;

                      const mediaResponse = await fetch(
                        `https://graph.facebook.com/v21.0/${mediaId}`,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                      );
                      let downloadUrl: string | null = null;
                      if (mediaResponse.ok) {
                        const mediaData = await mediaResponse.json();
                        downloadUrl = mediaData.url;
                      } else {
                        console.error("Sticker media API error:", await mediaResponse.text());
                      }
                      if (downloadUrl) {
                        const stickerResponse = await fetch(downloadUrl, {
                          headers: { Authorization: `Bearer ${accessToken}` },
                        });
                        if (stickerResponse.ok) {
                          const arrayBuffer = await stickerResponse.arrayBuffer();
                          const uint8Array = new Uint8Array(arrayBuffer);
                          const { error: uploadError } = await supabase.storage
                            .from("documents")
                            .upload(`stickers/${fileName}`, uint8Array, { contentType: mimeType, upsert: false });
                          if (uploadError) {
                            console.error("Sticker storage upload error:", uploadError);
                          } else {
                            const { data: urlData } = supabase.storage.from("documents").getPublicUrl(`stickers/${fileName}`);
                            imageUrl = urlData.publicUrl;
                            console.log("Sticker uploaded successfully, URL:", imageUrl);
                          }
                        } else {
                          console.error("Sticker download failed:", await stickerResponse.text());
                        }
                      }
                    }
                  } catch (stickerError) {
                    console.error("Error downloading sticker:", stickerError);
                  }
                } else if (message.type === "reaction") {
                  messageType = "reaction";
                  const emoji = message.reaction?.emoji || "";
                  const refId = message.reaction?.message_id;
                  let reactsToId: string | null = null;
                  if (refId) {
                    const { data: origMsg } = await supabase
                      .from("messages")
                      .select("id")
                      .eq("whatsapp_message_id", refId)
                      .maybeSingle();
                    if (origMsg) reactsToId = origMsg.id;
                  }
                  content = emoji || "";
                  // Stash for insert below
                  (messageInsertExtra as any).reacts_to_message_id = reactsToId;
                } else if (message.type === "video") {
                  content = "[Vídeo recebido]";
                } else if (message.type === "contacts") {
                  // vCard sharing — extract name + phone numbers
                  const cards = message.contacts || [];
                  const lines: string[] = [];
                  for (const card of cards) {
                    const name = card?.name?.formatted_name || card?.name?.first_name || "Contato";
                    const phones: string[] = (card?.phones || [])
                      .map((p: any) => p?.phone || p?.wa_id)
                      .filter(Boolean);
                    if (phones.length === 0) {
                      lines.push(`👤 ${name}`);
                    } else {
                      lines.push(`👤 ${name}\n📞 ${phones.join(", ")}`);
                    }
                  }
                  content = `[Contato compartilhado]\n${lines.join("\n\n")}`;
                } else if (message.type === "unsupported") {
                  // WhatsApp sends "unsupported" type when a client deletes a message for everyone.
                  console.log("🔎 Unsupported message payload:", JSON.stringify(message));
                  const hasRevoke = message.errors?.some(
                    (e: any) =>
                      e.code === 131051 ||
                      String(e.title || "").toLowerCase().includes("revoke") ||
                      String(e.message || "").toLowerCase().includes("revoke") ||
                      String(e.error_data?.details || "").toLowerCase().includes("revoke")
                  );
                  // Try any id field Meta might use to reference the deleted message.
                  const candidateIds = [
                    message.context?.id,
                    message.referral?.message_id,
                    message.errors?.[0]?.error_data?.message_id,
                    message.id, // deletion notifications sometimes reuse original wamid
                  ].filter(Boolean);

                  let marked = false;
                  for (const refId of candidateIds) {
                    const { data: origMsg } = await supabase
                      .from("messages")
                      .select("id")
                      .eq("whatsapp_message_id", refId)
                      .maybeSingle();
                    if (origMsg) {
                      await supabase
                        .from("messages")
                        .update({ is_deleted: true, content: "Mensagem apagada" })
                        .eq("id", origMsg.id);
                      console.log(`🗑️ Message ${refId} marked as deleted (unsupported/revoke)`);
                      marked = true;
                      break;
                    }
                  }
                  if (marked) continue;

                  // Fallback: revoke signal but no id match — mark most recent incoming
                  // message from this contact as deleted (best-effort).
                  if (hasRevoke) {
                    const { data: recentMsg } = await supabase
                      .from("messages")
                      .select("id")
                      .eq("contact_id", contactId)
                      .eq("direction", "incoming")
                      .eq("is_deleted", false)
                      .order("created_at", { ascending: false })
                      .limit(1)
                      .maybeSingle();
                    if (recentMsg) {
                      await supabase
                        .from("messages")
                        .update({ is_deleted: true, content: "Mensagem apagada" })
                        .eq("id", recentMsg.id);
                      console.log(`🗑️ Fallback: latest incoming message marked as deleted for contact ${contactId}`);
                    } else {
                      console.log(`🗑️ Revoke received but no message to mark for contact ${contactId}`);
                    }
                    continue;
                  }
                  content = `[${message.type}]`;
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
                Object.assign(messageInsert, messageInsertExtra);

                const { error: messageError } = await supabase.from("messages").insert(messageInsert);

                if (messageError) {
                  console.error("Error saving message:", messageError);
                }

                // === Mark contact as "respondido" on ANY incoming message ===
                // Applies to text, audio, image, document, video, sticker — any client reply.
                {
                  const currentStatus = existingContact?.status;
                  if (currentStatus === "aguardando" || currentStatus === "novo") {
                    console.log(`✅ Marking contact ${contactId} as respondido (was: ${currentStatus}, type: ${message.type})`);
                    await supabase
                      .from("contacts")
                      .update({ status: "respondido" })
                      .eq("id", contactId);
                  }
                }

                // === AI Agent: Process message if ai_enabled ===
                if (existingContact?.ai_enabled && message.type === "text" && content) {
                  try {
                    console.log(`🤖 Triggering AI agent for contact ${contactId}`);
                    const aiResponse = await fetch(
                      `${supabaseUrl}/functions/v1/ai-chat-agent`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${supabaseKey}`,
                        },
                        body: JSON.stringify({
                          contactId,
                          incomingMessage: content,
                        }),
                      }
                    );
                    const aiResult = await aiResponse.json();
                    console.log("AI agent result:", JSON.stringify(aiResult));
                  } catch (aiError) {
                    console.error("AI agent invocation error:", aiError);
                  }
                }

                console.log(`Message saved successfully from ${phone}`);
              }

              // Process status updates
              const statuses = value.statuses || [];
              // Status hierarchy — never regress to a lower status
              const STATUS_RANK: Record<string, number> = {
                pending: 0,
                sent: 1,
                delivered: 2,
                read: 3,
                failed: 4,
              };

              for (const status of statuses) {
                const messageId = status.id;
                const statusValue = status.status;

                console.log(`Status update for message ${messageId}: ${statusValue}`);

                // Handle "deleted" status — mark the message as deleted
                if (statusValue === "deleted") {
                  await supabase
                    .from("messages")
                    .update({ is_deleted: true, content: "Mensagem apagada" })
                    .eq("whatsapp_message_id", messageId);
                  console.log(`🗑️ Message ${messageId} marked as deleted via status update`);
                  continue;
                }

                // Check current status to prevent regression
                const { data: existingMsg } = await supabase
                  .from("messages")
                  .select("status")
                  .eq("whatsapp_message_id", messageId)
                  .maybeSingle();

                if (existingMsg) {
                  const currentRank = STATUS_RANK[existingMsg.status] ?? -1;
                  const newRank = STATUS_RANK[statusValue] ?? -1;

                  // Don't regress status (e.g. "read" → "delivered")
                  // Exception: "failed" always applies
                  if (newRank <= currentRank && statusValue !== "failed") {
                    console.log(`Skipping status regression: ${existingMsg.status} → ${statusValue}`);
                    continue;
                  }
                }

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
