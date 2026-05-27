import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Map a variable mapping key to the actual contact field value
function isEmpty(val: any): boolean {
  return !val || val === "Não informado" || val.toString().trim() === "";
}

function formatFirstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] || "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function normalizePhone(phone: string | null | undefined): string {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeText(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+\/\d+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function validIdentity(value: string | null | undefined): string {
  const cleaned = String(value || "").trim();
  if (!cleaned || cleaned === "Não informado" || cleaned === "********" || cleaned.includes("XXXX")) return "";
  return cleaned;
}

function resolveVariable(contact: any, fieldKey: string, extra?: { phoneVerifiedName?: string }): string {
  switch (fieldKey) {
    case "name": return isEmpty(contact.name) ? "Cliente" : formatFirstName(contact.name);
    case "phone": return contact.phone || "";
    case "lawyer_name": return isEmpty(contact.lawyer_name) ? "********" : contact.lawyer_name;
    case "process_number": return isEmpty(contact.process_number) ? "0031486-26.2025.8.26.0002" : contact.process_number;
    case "cpf": return isEmpty(contact.cpf) ? "Não informado" : contact.cpf;
    case "valor_da_causa": return contact.valor_da_causa ? `R$ ${Number(contact.valor_da_causa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Não informado";
    case "advogado": {
      const raw = extra?.phoneVerifiedName || "Advogado";
      return raw.split("|")[0].trim();
    }
    default: return fieldKey;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contactIds, templateName, templateLanguage, userId, assignedUserId, selectedPhoneNumberId, variableMappings, phoneVerifiedName, dispatchMode } = await req.json();
    const isSharedDispatch = dispatchMode === "shared";

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Lista de contatos é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!templateName) {
      return new Response(
        JSON.stringify({ error: "Nome do template é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization user (quem está executando) e usuário de atribuição (responsável pós-disparo)
    const requesterUserId = userId || null;
    const assignedDispatchUserId = assignedUserId || userId || null;

    // Check if requester has permission to use shared API
    let config = null;

    if (requesterUserId) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("can_use_shared_api")
        .eq("user_id", requesterUserId)
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
          .eq("user_id", requesterUserId)
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
        JSON.stringify({ error: "WhatsApp não configurado ou você não tem permissão para usar a API compartilhada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("*")
      .in("id", contactIds);

    if (contactsError || !contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum contato encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // O envio só pode acontecer para contatos ainda disponíveis na fila.
    // Se um contato já saiu da lista/status "novo", a função não envia novamente.
    const eligibleContacts = contacts;

    const results = {
      total: contacts.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    let finalPhoneNumberId = config.phone_number_id;

    if (selectedPhoneNumberId) {
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

      if (requesterUserId) {
        const { data: isUserAdmin } = await supabase.rpc("is_admin", { _user_id: requesterUserId });
        if (!isUserAdmin) {
          // Check user_phone_permissions OR if user created this number
          const { data: permission } = await supabase
            .from("user_phone_permissions")
            .select("id")
            .eq("user_id", requesterUserId)
            .eq("phone_number_id", phoneRecord.id)
            .maybeSingle();

          const { data: isCreator } = await supabase
            .from("waba_phone_numbers")
            .select("id")
            .eq("id", phoneRecord.id)
            .eq("created_by", requesterUserId)
            .maybeSingle();

          if (!permission && !isCreator) {
            return new Response(
              JSON.stringify({ error: "Você não tem permissão para usar este número de disparo." }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      finalPhoneNumberId = selectedPhoneNumberId;
    }

    const whatsappUrl = `https://graph.facebook.com/v18.0/${finalPhoneNumberId}/messages`;

    // variableMappings is an object like { "1": "name", "2": "process_number" }
    const hasVariables = variableMappings && Object.keys(variableMappings).length > 0;

    // Fetch the template body once so we can render the actual message text for the saved bubble
    let templateBody = "";
    try {
      if ((config as any).waba_id) {
        const tplRes = await fetch(
          `https://graph.facebook.com/v18.0/${(config as any).waba_id}/message_templates?name=${encodeURIComponent(templateName)}&limit=10`,
          { headers: { Authorization: `Bearer ${config.access_token}` } }
        );
        const tplJson = await tplRes.json();
        const lang = templateLanguage || "pt_BR";
        const match =
          (tplJson.data || []).find((t: any) => t.name === templateName && t.language === lang) ||
          (tplJson.data || []).find((t: any) => t.name === templateName) ||
          (tplJson.data || [])[0];
        const bodyComp = match?.components?.find((c: any) => c.type === "BODY");
        templateBody = bodyComp?.text || "";
      }
    } catch (e) {
      console.error("Failed to fetch template body for rendering:", e);
    }

    for (const contact of eligibleContacts) {
      try {
        if (contact.status !== "novo") {
          results.skipped++;
          results.errors.push(`${contact.name}: já removido da lista de disparo`);
          continue;
        }

        if (contact.status === "encerrado") {
          results.failed++;
          results.errors.push(`${contact.name}: Cliente bloqueado`);
          continue;
        }

        // Admin bulk dispatch skips phone ownership check
        // The admin has authority to reassign contacts to any operator

        // Em modo compartilhado: contato fica sem dono até alguém assumir
        const effectiveUserId = isSharedDispatch
          ? null
          : (contact.user_id || assignedDispatchUserId || requesterUserId || null);

        // Build template object with personalized variables
        const templateObj: any = {
          name: templateName,
          language: { code: templateLanguage || "pt_BR" },
        };

        if (hasVariables) {
          const sortedKeys = Object.keys(variableMappings).sort((a, b) => parseInt(a) - parseInt(b));
          const parameters = sortedKeys.map((key) => ({
            type: "text",
            text: resolveVariable(contact, variableMappings[key], { phoneVerifiedName }),
          }));

          templateObj.components = [
            {
              type: "body",
              parameters,
            },
          ];
        }

        const requestBody = {
          messaging_product: "whatsapp",
          to: contact.phone,
          type: "template",
          template: templateObj,
        };

        console.log(`Sending template to ${contact.name} (${contact.phone})`, JSON.stringify(requestBody));

        const response = await fetch(whatsappUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();

        if (!response.ok) {
          const errorCode = result.error?.code;
          const errorMsg = result.error?.message || "Erro desconhecido";
          
          // Translate common Meta API errors to Portuguese
          let friendlyMsg = errorMsg;
          let shouldStopBatch = false;
          
          switch (errorCode) {
            case 131031:
              friendlyMsg = "🔒 Conta Business bloqueada pela Meta. Verifique no Meta Business Suite.";
              shouldStopBatch = true;
              break;
            case 131049:
              friendlyMsg = "⚠️ Bloqueado pela Meta para manter engajamento saudável";
              break;
            case 131026:
              friendlyMsg = "📵 Número não possui WhatsApp";
              // Mark contact as not having WhatsApp
              await supabase.from("contacts").update({ has_whatsapp: false }).eq("id", contact.id);
              break;
            case 131047:
              friendlyMsg = "⏳ Mensagem não enviada - mais de 24h sem interação";
              break;
            case 131056:
              friendlyMsg = "🚫 Número de destino faz parte de uma conta business";
              break;
            case 131053:
              friendlyMsg = "📵 Número de telefone inválido ou não registrado";
              break;
          }
          
          results.failed++;
          results.errors.push(`${contact.name}: ${friendlyMsg}`);
          console.error(`Failed to send to ${contact.name}: code=${errorCode}`, result.error);
          
          // If business account is locked, stop entire batch
          if (shouldStopBatch) {
            results.errors.push("🛑 Disparo interrompido: Conta Business bloqueada pela Meta.");
            break;
          }
          continue;
        }

        // Build personalized content for the saved message — render the actual template text the client sees
        let savedContent = templateBody || `[Template: ${templateName}]`;
        if (hasVariables && templateBody) {
          for (const [k, v] of Object.entries(variableMappings)) {
            const val = resolveVariable(contact, v as string, { phoneVerifiedName });
            savedContent = savedContent.split(`{{${k}}}`).join(val);
          }
        }

        let { data: conversation } = await supabase
          .from("conversations")
          .select("*")
          .eq("contact_id", contact.id)
          .eq("is_active", true)
          .single();

        if (!conversation) {
          const { data: newConversation } = await supabase
            .from("conversations")
            .insert({
              contact_id: contact.id,
              user_id: effectiveUserId,
              is_active: true,
              window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            })
            .select()
            .single();
          conversation = newConversation;
        } else {
          // Reuse existing conversation: refresh window and update user if needed
          const updates: any = {
            window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          };
          if (!conversation.user_id && effectiveUserId) {
            updates.user_id = effectiveUserId;
          }
          await supabase
            .from("conversations")
            .update(updates)
            .eq("id", conversation.id);
        }

        await supabase.from("messages").insert({
          conversation_id: conversation!.id,
          contact_id: contact.id,
          user_id: effectiveUserId,
          direction: "outgoing",
          message_type: "template",
          content: savedContent,
          template_name: templateName,
          whatsapp_message_id: result.messages?.[0]?.id,
          status: "sent",
        });

        const originalContactList = contact.contact_list;
        const contactUpdate: any = {
          status: "aguardando",
          last_message_at: new Date().toISOString(),
          user_id: effectiveUserId,
          dispatched_phone_number_id: finalPhoneNumberId,
          contact_list: null,
        };
        if (isSharedDispatch) {
          contactUpdate.dispatch_mode = "shared";
          contactUpdate.claimed_by = null;
          contactUpdate.claimed_at = null;
        } else {
          contactUpdate.dispatch_mode = "private";
        }
        await supabase
          .from("contacts")
          .update(contactUpdate)
          .eq("id", contact.id);

        if (originalContactList) {
          const targetPhone = normalizePhone(contact.phone);
          const targetCpf = normalizePhone(validIdentity(contact.cpf));
          const targetProcess = validIdentity(contact.process_number);
          const targetName = normalizeText(contact.name);
          const { data: duplicates } = await supabase
            .from("contacts")
            .select("id, name, phone, cpf, process_number")
            .eq("contact_list", originalContactList)
            .eq("status", "novo");

          const duplicateIds = (duplicates || [])
            .filter((row: any) => {
              if (row.id === contact.id) return false;
              const samePhone = !!targetPhone && normalizePhone(row.phone) === targetPhone;
              const sameCpf = !!targetCpf && normalizePhone(validIdentity(row.cpf)) === targetCpf;
              const sameProcess = !!targetProcess && validIdentity(row.process_number) === targetProcess;
              const sameName = !!targetName && normalizeText(row.name) === targetName;
              return samePhone || sameCpf || sameProcess || sameName;
            })
            .map((row: any) => row.id);

          for (let i = 0; i < duplicateIds.length; i += 100) {
            const batch = duplicateIds.slice(i, i + 100);
            await supabase
              .from("contacts")
              .update({
                status: "encerrado",
                contact_list: null,
                last_message_at: new Date().toISOString(),
              })
              .in("id", batch);
          }
        }

        if (effectiveUserId) {
          await supabase.rpc("increment_templates_sent", { _user_id: effectiveUserId });
        }

        results.sent++;
        // Only add delay when processing multiple contacts in a single call
        if (contacts.length > 1) {
          const humanDelay = Math.floor(Math.random() * 3000) + 2000;
          await delay(humanDelay);
        }
      } catch (err) {
        results.failed++;
        const errMessage = err instanceof Error ? err.message : "Erro desconhecido";
        results.errors.push(`${contact.name}: ${errMessage}`);
        console.error(`Error sending to ${contact.name}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Disparo concluído: ${results.sent} enviados, ${results.failed} falhas`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Bulk send error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
