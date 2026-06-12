import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const s = createClient(url, key, { auth: { persistSession: false } });

    const ADMIN_ID = "709f6876-bdf8-4aa3-b3c8-3db3fed752ba";

    const { data: list, error: lErr } = await s.auth.admin.listUsers({ perPage: 1000 });
    if (lErr) throw lErr;

    let signedOut = 0;
    const errors: string[] = [];
    for (const u of list.users) {
      const r = await fetch(`${url}/auth/v1/admin/users/${u.id}/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scope: "global" }),
      });
      if (r.ok || r.status === 204) signedOut++;
      else errors.push(`${u.id}: ${r.status} ${await r.text()}`);
    }

    const { error: pErr } = await s.auth.admin.updateUserById(ADMIN_ID, {
      password: "JurisZap@2026!",
    });
    if (pErr) errors.push(`password: ${pErr.message}`);

    const { error: dErr } = await s
      .from("device_sessions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (dErr) errors.push(`device_sessions: ${dErr.message}`);

    return new Response(
      JSON.stringify({ success: true, signedOut, total: list.users.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
