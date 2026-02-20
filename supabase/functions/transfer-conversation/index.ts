import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_USER_ID = "c1ab9e7b-3567-4712-ad77-e3909cc45abf"; // conversar@Sys

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user: callerUser }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contactId } = await req.json();
    if (!contactId) {
      return new Response(JSON.stringify({ error: "contactId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the contact belongs to the caller (prevent transferring other users' contacts)
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, user_id")
      .eq("id", contactId)
      .eq("user_id", callerUser.id)
      .maybeSingle();

    if (!contact) {
      return new Response(JSON.stringify({ error: "Contato não encontrado ou não pertence a você" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transfer contact to conversar@Sys using service role (bypasses RLS)
    const { error: contactErr } = await supabase
      .from("contacts")
      .update({ user_id: TARGET_USER_ID })
      .eq("id", contactId);

    if (contactErr) {
      console.error("Contact update error:", contactErr.message);
      return new Response(JSON.stringify({ error: contactErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transfer active conversation
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, user_id")
      .eq("contact_id", contactId)
      .eq("is_active", true)
      .maybeSingle();

    if (conv) {
      const { error: convErr } = await supabase
        .from("conversations")
        .update({
          user_id: TARGET_USER_ID,
          transferred_at: new Date().toISOString(),
          transferred_by: callerUser.id,
          original_user_id: conv.user_id,
        })
        .eq("id", conv.id);

      if (convErr) {
        console.error("Conversation update error:", convErr.message);
      }
    }

    // Also transfer all messages of this conversation so operator can't see them
    if (conv) {
      await supabase
        .from("messages")
        .update({ user_id: TARGET_USER_ID })
        .eq("conversation_id", conv.id)
        .eq("user_id", callerUser.id);
    }

    console.log(`Transferred contact ${contactId} from ${callerUser.id} to ${TARGET_USER_ID}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Transfer error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
