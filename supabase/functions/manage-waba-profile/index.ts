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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: roles } = await anonClient.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, phone_number_id } = body;

    // Get admin's whatsapp config for access token
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: waConfig } = await serviceClient
      .from("whatsapp_config")
      .select("access_token")
      .limit(1)
      .single();

    if (!waConfig?.access_token) {
      return new Response(JSON.stringify({ error: "WhatsApp API não configurada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = waConfig.access_token;

    if (action === "get_profile") {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phone_number_id}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Erro ao buscar perfil");
      }

      return new Response(JSON.stringify({ success: true, data: data.data?.[0] || {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "update_profile") {
      const { about, address, description, email, websites, vertical, profile_picture_handle } = body;

      const profileData: Record<string, unknown> = {
        messaging_product: "whatsapp",
      };
      if (about !== undefined) profileData.about = about;
      if (address !== undefined) profileData.address = address;
      if (description !== undefined) profileData.description = description;
      if (email !== undefined) profileData.email = email;
      if (websites !== undefined) profileData.websites = websites;
      if (vertical !== undefined) profileData.vertical = vertical;
      if (profile_picture_handle !== undefined) profileData.profile_picture_handle = profile_picture_handle;

      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phone_number_id}/whatsapp_business_profile`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profileData),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Erro ao atualizar perfil");
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: unknown) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
