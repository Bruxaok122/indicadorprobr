import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Map a variable mapping key to the actual contact field value
function resolveVariable(contact: any, fieldKey: string): string {
  switch (fieldKey) {
    case "name": return contact.name || "";
    case "phone": return contact.phone || "";
    case "lawyer_name": return contact.lawyer_name || "";
    case "process_number": return contact.process_number || "";
    case "cpf": return contact.cpf || "";
    case "valor_da_causa": return contact.valor_da_causa ? `R$ ${Number(contact.valor_da_causa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "";
    default: return fieldKey; // treat as literal text
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

    const { contactIds, templateName, templateLanguage, userId, selectedPhoneNumberId, variableMappings } = await req.json();

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

    // Check if user has permission to use shared API
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

    const results = { total: contacts.length, sent: 0, failed: 0, errors: [] as string[] };

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

      if (userId) {
        const { data: isUserAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
        if (!isUserAdmin) {
          const { data: permission } = await supabase
            .from("user_phone_permissions")
            .select("id")
            .eq("user_id", userId)
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

    const whatsappUrl = `https://graph.facebook.com/v18.0/${finalPhoneNumberId}/messages`;

    // variableMappings is an object like { "1": "name", "2": "process_number" }
    const hasVariables = variableMappings && Object.keys(variableMappings).length > 0;

    for (const contact of contacts) {
      try {
        if (contact.status === "encerrado") {
          results.failed++;
          results.errors.push(`${contact.name}: Cliente bloqueado`);
          continue;
        }

        if (userId) {
          const { data: existingOwner } = await supabase
            .from("contacts")
            .select("user_id")
            .eq("phone", contact.phone)
            .not("user_id", "is", null)
            .neq("user_id", userId)
            .limit(1)
            .maybeSingle();

          if (existingOwner) {
            results.failed++;
            results.errors.push(`${contact.name}: Este contato já foi atendido por outro usuário`);
            continue;
          }
        }

        const effectiveUserId = contact.user_id || userId || null;

        // Build template object with personalized variables
        const templateObj: any = {
          name: templateName,
          language: { code: templateLanguage || "pt_BR" },
        };

        if (hasVariables) {
          const sortedKeys = Object.keys(variableMappings).sort((a, b) => parseInt(a) - parseInt(b));
          const parameters = sortedKeys.map((key) => ({
            type: "text",
            text: resolveVariable(contact, variableMappings[key]),
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
          results.failed++;
          results.errors.push(`${contact.name}: ${result.error?.message || "Erro desconhecido"}`);
          console.error(`Failed to send to ${contact.name}:`, result.error);
          continue;
        }

        // Build personalized content for the saved message
        let savedContent = `[Template: ${templateName}]`;
        if (hasVariables) {
          const varDetails = Object.entries(variableMappings)
            .map(([k, v]) => `{{${k}}}=${resolveVariable(contact, v as string)}`)
            .join(", ");
          savedContent = `[Template: ${templateName}] (${varDetails})`;
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
        } else if (!conversation.user_id && effectiveUserId) {
          await supabase
            .from("conversations")
            .update({ user_id: effectiveUserId })
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

        await supabase
          .from("contacts")
          .update({ status: "aguardando", last_message_at: new Date().toISOString(), user_id: effectiveUserId })
          .eq("id", contact.id);

        if (effectiveUserId) {
          await supabase.rpc("increment_templates_sent", { _user_id: effectiveUserId });
        }

        results.sent++;
        await delay(100);
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
