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

    // Prefer the currently active API config (multi-WABA), fall back to legacy whatsapp_config
    let waba_id: string | null = null;
    let access_token: string | null = null;

    const { data: activeApi } = await supabase
      .from("api_configs")
      .select("waba_id, access_token")
      .eq("is_active", true)
      .maybeSingle();

    if (activeApi?.waba_id && activeApi?.access_token) {
      waba_id = activeApi.waba_id;
      access_token = activeApi.access_token;
    } else {
      const { data: legacy } = await supabase
        .from("whatsapp_config")
        .select("waba_id, access_token")
        .limit(1)
        .maybeSingle();
      waba_id = legacy?.waba_id ?? null;
      access_token = legacy?.access_token ?? null;
    }

    if (!waba_id || !access_token) {
      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado. Configure o Access Token e WABA ID primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = { waba_id, access_token };

    // The stored "waba_id" may actually be a phone_number_id (multi-WABA configs store it that way).
    // Try as WABA first; on (#100) "nonexisting field (phone_numbers)" fallback to treating the id as a phone_number_id.
    const fields = "id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,throughput";
    let result: any;
    let response = await fetch(
      `https://graph.facebook.com/v21.0/${config.waba_id}/phone_numbers?fields=${fields}`,
      { headers: { "Authorization": `Bearer ${config.access_token}` } }
    );
    result = await response.json();
    console.log("Meta API response (WABA list):", JSON.stringify(result, null, 2));

    const isPhoneIdFallback =
      !response.ok &&
      result?.error?.code === 100 &&
      String(result?.error?.message || "").includes("phone_numbers");

    if (isPhoneIdFallback) {
      console.log("Falling back: treating id as phone_number_id");
      response = await fetch(
        `https://graph.facebook.com/v21.0/${config.waba_id}?fields=${fields}`,
        { headers: { "Authorization": `Bearer ${config.access_token}` } }
      );
      const single = await response.json();
      console.log("Meta API response (single phone):", JSON.stringify(single, null, 2));
      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: single.error?.message || "Erro ao buscar número" }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      result = { data: [single] };
    } else if (!response.ok) {
      return new Response(
        JSON.stringify({ error: result.error?.message || "Erro ao buscar números" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Deactivate numbers no longer in the API response
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
