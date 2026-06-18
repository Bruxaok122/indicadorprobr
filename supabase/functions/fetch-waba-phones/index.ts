import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Synchronization is intentionally scoped to the single API marked active.
    // Do not merge numbers from legacy/shared configs or inactive API rows.
    const { data: activeApi } = await supabase
      .from("api_configs")
      .select("id, name, waba_id, phone_number_id, access_token")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeApi?.id || !activeApi?.access_token) {
      return new Response(
        JSON.stringify({ error: "Nenhuma API ativa configurada. Ative uma API antes de sincronizar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fields = "id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,throughput";

    // Resolve the real WABA id behind a token via debug_token (handles cases where waba_id is stored as a phone_number_id)
    async function resolveRealWabaIds(token: string): Promise<string[]> {
      try {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`
        );
        const j = await r.json();
        const scopes = j?.data?.granular_scopes || [];
        const ids = new Set<string>();
        for (const s of scopes) {
          if (s?.scope === "whatsapp_business_messaging" || s?.scope === "whatsapp_business_management") {
            for (const t of s?.target_ids || []) ids.add(String(t));
          }
        }
        return Array.from(ids);
      } catch {
        return [];
      }
    }

    async function resolveWabaFromPhoneId(id: string | null | undefined, token: string): Promise<string | null> {
      const cleanId = String(id || "").trim();
      if (!cleanId) return null;
      try {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${cleanId}?fields=whatsapp_business_account{id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const j = await r.json();
        return j?.whatsapp_business_account?.id ?? null;
      } catch {
        return null;
      }
    }

    const collected: any[] = [];
    let resolvedWabaId: string | null = null;
    const seenIds = new Set<string>();

    const tryWaba = async (wabaId: string) => {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=${fields}`,
        { headers: { Authorization: `Bearer ${activeApi.access_token}` } }
      );
      const j = await r.json();
      console.log(`Meta phones for active API ${activeApi.name || activeApi.id} (${wabaId}):`, JSON.stringify(j));
      return { ok: r.ok, json: j, wabaId };
    };

    const candidateWabaIds = Array.from(new Set([
      activeApi.waba_id,
      await resolveWabaFromPhoneId(activeApi.waba_id, activeApi.access_token),
      await resolveWabaFromPhoneId(activeApi.phone_number_id, activeApi.access_token),
      ...(await resolveRealWabaIds(activeApi.access_token)),
    ].filter(Boolean).map(String)));

    for (const wabaId of candidateWabaIds) {
      const listed = await tryWaba(wabaId);
      if (listed.ok && Array.isArray(listed.json?.data)) {
        resolvedWabaId = wabaId;
        for (const p of listed.json.data) {
          if (p?.id && p?.display_phone_number && !seenIds.has(p.id)) {
            seenIds.add(p.id);
            collected.push(p);
          }
        }
        break;
      }
    }

    if (collected.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum número válido encontrado nas APIs configuradas." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map and upsert phone numbers
    const nowIso = new Date().toISOString();
    const phones = (collected || []).map((phone: any) => ({
      phone_number_id: phone.id,
      display_phone_number: phone.display_phone_number,
      verified_name: phone.verified_name || null,
      quality_rating: phone.quality_rating || null,
      messaging_tier: phone.messaging_limit_tier || phone.throughput?.level || null,
      tier_updated_at: (phone.messaging_limit_tier || phone.throughput?.level) ? nowIso : null,
      is_active: true,
      api_config_id: activeApi.id,
    }));

    for (const phone of phones) {
      await supabase
        .from("waba_phone_numbers")
        .upsert(phone, { onConflict: "phone_number_id" });
    }

    // Deactivate every number not returned by the currently active API.
    const activeMetaIds = phones.map((p: any) => p.phone_number_id);
    if (activeMetaIds.length > 0) {
      const { data: allDbPhones } = await supabase
        .from("waba_phone_numbers")
        .select("id, phone_number_id");

      const toDeactivate = (allDbPhones || [])
        .filter((db: any) => !activeMetaIds.includes(db.phone_number_id))
        .map((db: any) => db.id);

      if (toDeactivate.length > 0) {
        await supabase
          .from("waba_phone_numbers")
          .update({ is_active: false })
          .in("id", toDeactivate);
      }
    }

    const primaryPhoneId = activeApi.phone_number_id && activeMetaIds.includes(activeApi.phone_number_id)
      ? activeApi.phone_number_id
      : activeMetaIds[0];

    await supabase
      .from("api_configs")
      .update({
        waba_id: resolvedWabaId || activeApi.waba_id,
        phone_number_id: primaryPhoneId,
        is_validated: true,
        status_message: `${phones.length} número(s) sincronizado(s) da API ativa`,
      })
      .eq("id", activeApi.id);

    return new Response(
      JSON.stringify({ success: true, phones, total: phones.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Fetch WABA phones error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
