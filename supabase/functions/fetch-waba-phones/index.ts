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

    // Aggregate candidate (waba_id, access_token) sources to discover real phones across all configs.
    type Candidate = { label: string; waba_id: string; access_token: string };
    const candidates: Candidate[] = [];

    const { data: activeApis } = await supabase
      .from("api_configs")
      .select("name, waba_id, access_token")
      .eq("is_active", true);
    for (const a of activeApis || []) {
      if (a?.waba_id && a?.access_token) {
        candidates.push({ label: `api_configs:${a.name || "active"}`, waba_id: a.waba_id, access_token: a.access_token });
      }
    }

    const { data: legacy } = await supabase
      .from("whatsapp_config")
      .select("waba_id, access_token")
      .limit(1)
      .maybeSingle();
    if (legacy?.waba_id && legacy?.access_token) {
      candidates.push({ label: "whatsapp_config", waba_id: legacy.waba_id, access_token: legacy.access_token });
    }

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado. Configure o Access Token e WABA ID primeiro." }),
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

    const collected: any[] = [];
    let didFullListing = false;
    const seenIds = new Set<string>();

    for (const cand of candidates) {
      const tryWaba = async (wabaId: string) => {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=${fields}`,
          { headers: { Authorization: `Bearer ${cand.access_token}` } }
        );
        const j = await r.json();
        console.log(`Meta phones for ${cand.label} (${wabaId}):`, JSON.stringify(j));
        return { ok: r.ok, json: j };
      };

      let listed = await tryWaba(cand.waba_id);

      // If the stored waba_id isn't a WABA, resolve the real one(s) via debug_token
      if (!listed.ok && listed.json?.error?.code === 100) {
        const real = await resolveRealWabaIds(cand.access_token);
        for (const realWaba of real) {
          if (realWaba === cand.waba_id) continue;
          const r2 = await tryWaba(realWaba);
          if (r2.ok) {
            listed = r2;
            break;
          }
        }
      }

      if (listed.ok && Array.isArray(listed.json?.data)) {
        didFullListing = true;
        for (const p of listed.json.data) {
          if (p?.id && p?.display_phone_number && !seenIds.has(p.id)) {
            seenIds.add(p.id);
            collected.push(p);
          }
        }
      }
    }

    if (collected.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum número válido encontrado nas APIs configuradas." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = { data: collected };
    const isPhoneIdFallback = !didFullListing;

    // Map and upsert phone numbers
    const nowIso = new Date().toISOString();
    const phones = (result.data || []).map((phone: any) => ({
      phone_number_id: phone.id,
      display_phone_number: phone.display_phone_number,
      verified_name: phone.verified_name || null,
      quality_rating: phone.quality_rating || null,
      messaging_tier: phone.messaging_limit_tier || phone.throughput?.level || null,
      tier_updated_at: (phone.messaging_limit_tier || phone.throughput?.level) ? nowIso : null,
      is_active: true,
    }));

    for (const phone of phones) {
      await supabase
        .from("waba_phone_numbers")
        .upsert(phone, { onConflict: "phone_number_id" });
    }

    // Deactivate numbers no longer in the API response — only when we did a full WABA listing
    const activeMetaIds = phones.map((p: any) => p.phone_number_id);
    if (!isPhoneIdFallback && activeMetaIds.length > 0) {
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
