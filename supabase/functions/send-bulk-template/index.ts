import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Add delay between messages to respect Meta rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contactIds, templateName, templateLanguage, userId } = await req.json();

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

    // Get contacts
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

    const results = {
      total: contacts.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    const whatsappUrl = `https://graph.facebook.com/v18.0/${config.phone_number_id}/messages`;

    for (const contact of contacts) {
      try {
        // Use the contact's user_id if available, otherwise use the provided userId
        const effectiveUserId = contact.user_id || userId || null;

        const requestBody = {
          messaging_product: "whatsapp",
          to: contact.phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage || "pt_BR" },
          },
        };

        console.log(`Sending template to ${contact.name} (${contact.phone})`);

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

        // Get or create conversation - IMPORTANT: include user_id
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
          // Update existing conversation with user_id if missing
          await supabase
            .from("conversations")
            .update({ user_id: effectiveUserId })
            .eq("id", conversation.id);
        }

        // Save message - IMPORTANT: include user_id
        await supabase.from("messages").insert({
          conversation_id: conversation!.id,
          contact_id: contact.id,
          user_id: effectiveUserId,
          direction: "outgoing",
          message_type: "template",
          content: `[Template: ${templateName}]`,
          template_name: templateName,
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
          .eq("id", contact.id);

        // Update user stats - increment templates_sent
        if (effectiveUserId) {
          await supabase.rpc("increment_templates_sent", { _user_id: effectiveUserId });
        }

        results.sent++;

        // Rate limiting: wait 100ms between messages to avoid throttling
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
