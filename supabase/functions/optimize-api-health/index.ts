import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await userClient.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const results: Record<string, number> = {};

    // 1. Clean old pending messages (> 1 hour) → mark as failed
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: stalePending } = await admin
      .from("messages")
      .update({ status: "failed", error_details: "Timeout: mensagem não processada" })
      .eq("status", "pending")
      .eq("direction", "outgoing")
      .lt("created_at", oneHourAgo)
      .select("id");
    results.pending_cleaned = stalePending?.length || 0;

    // 2. Close expired conversations (window_expires_at past)
    const now = new Date().toISOString();
    const { data: expiredConvos } = await admin
      .from("conversations")
      .update({ is_active: false })
      .eq("is_active", true)
      .lt("window_expires_at", now)
      .not("window_expires_at", "is", null)
      .select("id");
    results.conversations_closed = expiredConvos?.length || 0;

    // 3. Mark contacts with blocked errors as "encerrado"
    const { data: blockedMsgs } = await admin
      .from("messages")
      .select("contact_id")
      .eq("status", "failed")
      .in("error_code", ["131051", "131031"]);

    if (blockedMsgs && blockedMsgs.length > 0) {
      const blockedContactIds = [...new Set(blockedMsgs.map((m) => m.contact_id))];
      const { data: updated } = await admin
        .from("contacts")
        .update({ status: "encerrado" })
        .in("id", blockedContactIds)
        .neq("status", "encerrado")
        .select("id");
      results.blocked_contacts_closed = updated?.length || 0;
    } else {
      results.blocked_contacts_closed = 0;
    }

    // 4. Mark contacts with invalid numbers as "encerrado"
    const { data: invalidMsgs } = await admin
      .from("messages")
      .select("contact_id")
      .eq("status", "failed")
      .in("error_code", ["131026", "131053"]);

    if (invalidMsgs && invalidMsgs.length > 0) {
      const invalidContactIds = [...new Set(invalidMsgs.map((m) => m.contact_id))];
      const { data: updated } = await admin
        .from("contacts")
        .update({ status: "encerrado" })
        .in("id", invalidContactIds)
        .neq("status", "encerrado")
        .select("id");
      results.invalid_contacts_closed = updated?.length || 0;
    } else {
      results.invalid_contacts_closed = 0;
    }

    // 5. Close old "aguardando" contacts (no message in 7+ days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleContacts } = await admin
      .from("contacts")
      .update({ status: "encerrado" })
      .eq("status", "aguardando")
      .lt("last_message_at", sevenDaysAgo)
      .not("last_message_at", "is", null)
      .select("id");
    results.stale_contacts_closed = staleContacts?.length || 0;

    // 6. Delete duplicate failed messages (keep only the latest per contact with same error)
    // This is complex, so we just count them
    const { count: failedCount } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .eq("direction", "outgoing");
    results.total_failed_messages = failedCount || 0;

    const totalActions =
      results.pending_cleaned +
      results.conversations_closed +
      results.blocked_contacts_closed +
      results.invalid_contacts_closed +
      results.stale_contacts_closed;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Otimização concluída: ${totalActions} ações realizadas`,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Optimization error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao otimizar" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

