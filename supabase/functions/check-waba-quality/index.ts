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

    // Get active API config
    const { data: apiConfig, error: configError } = await supabase
      .from("api_configs")
      .select("*")
      .eq("is_active", true)
      .single();

    if (configError || !apiConfig) {
      return new Response(
        JSON.stringify({ error: "Nenhuma API ativa encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: {
      account: { id: string; name: string; status: string; quality: string | null; message_template_quality: string | null; ban_info: any };
      phones: { id: string; display_phone_number: string; quality_rating: string | null; status: string | null; name_status: string | null }[];
    } = {
      account: { id: apiConfig.waba_id, name: "", status: "UNKNOWN", quality: null, message_template_quality: null, ban_info: null },
      phones: [],
    };

    // 1. Check WABA Account status
    const wabaUrl = `https://graph.facebook.com/v21.0/${apiConfig.waba_id}?fields=id,name,account_review_status,message_template_namespace,ownership_type,on_behalf_of_business_info`;
    console.log("Checking WABA account:", apiConfig.waba_id);

    const wabaResponse = await fetch(wabaUrl, {
      headers: { Authorization: `Bearer ${apiConfig.access_token}` },
    });
    const wabaData = await wabaResponse.json();
    console.log("WABA response:", JSON.stringify(wabaData, null, 2));

    if (wabaResponse.ok) {
      results.account.name = wabaData.name || "";
      results.account.status = wabaData.account_review_status || "UNKNOWN";
    } else {
      results.account.status = wabaData.error?.code === 190 ? "TOKEN_EXPIRED" : "ERROR";
      results.account.ban_info = wabaData.error;
    }

    // 2. Check phone numbers quality from Meta API directly
    const phonesUrl = `https://graph.facebook.com/v21.0/${apiConfig.waba_id}/phone_numbers?fields=id,display_phone_number,quality_rating,verified_name,name_status,status`;
    const phonesResponse = await fetch(phonesUrl, {
      headers: { Authorization: `Bearer ${apiConfig.access_token}` },
    });
    const phonesData = await phonesResponse.json();
    console.log("Phones quality response:", JSON.stringify(phonesData, null, 2));

    if (phonesResponse.ok && phonesData.data) {
      for (const phone of phonesData.data) {
        results.phones.push({
          id: phone.id,
          display_phone_number: phone.display_phone_number,
          quality_rating: phone.quality_rating || null,
          status: phone.status || null,
          name_status: phone.name_status || null,
        });

        // Update quality_rating in our database
        await supabase
          .from("waba_phone_numbers")
          .update({ quality_rating: phone.quality_rating || null })
          .eq("phone_number_id", phone.id);
      }
    }

    // 3. Check messaging limits (account-level quality indicator)
    const limitsUrl = `https://graph.facebook.com/v21.0/${apiConfig.waba_id}?fields=messaging_limit_tier`;
    const limitsResponse = await fetch(limitsUrl, {
      headers: { Authorization: `Bearer ${apiConfig.access_token}` },
    });
    const limitsData = await limitsResponse.json();
    
    if (limitsResponse.ok) {
      results.account.message_template_quality = limitsData.messaging_limit_tier || null;
    }

    // 4. Update api_configs status_message with account quality summary
    const hasIssues = results.account.status !== "APPROVED" || 
                      results.phones.some(p => p.quality_rating && p.quality_rating !== "GREEN") ||
                      results.phones.some(p => p.status && !["CONNECTED", "READY"].includes(p.status));

    const statusMsg = hasIssues
      ? `⚠️ Problemas detectados - Conta: ${results.account.status}, Números com issues: ${results.phones.filter(p => p.quality_rating !== "GREEN").length}`
      : `✅ Tudo normal - Conta: ${results.account.status}`;

    await supabase
      .from("api_configs")
      .update({ status_message: statusMsg })
      .eq("id", apiConfig.id);

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Quality check error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao verificar quality: " + (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
