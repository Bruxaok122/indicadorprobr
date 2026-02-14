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

    const body = await req.json();
    const { action, phone_number_id } = body;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get access token (user's own or shared)
    const { data: userConfig } = await serviceClient
      .from("user_whatsapp_config")
      .select("access_token")
      .eq("user_id", user.id)
      .eq("is_validated", true)
      .limit(1)
      .single();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("can_use_shared_api")
      .eq("user_id", user.id)
      .single();

    let accessToken: string | null = null;

    if (userConfig?.access_token) {
      accessToken = userConfig.access_token;
    } else if (profile?.can_use_shared_api) {
      const { data: sharedConfig } = await serviceClient
        .from("whatsapp_config")
        .select("access_token")
        .limit(1)
        .single();
      accessToken = sharedConfig?.access_token || null;
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "WhatsApp API não configurada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_profile") {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phone_number_id}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
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

      const profileData: Record<string, unknown> = { messaging_product: "whatsapp" };
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

    } else if (action === "upload_profile_photo") {
      const { phone_number_id: uploadPhoneId } = body;

      // Get the image from the request body (base64)
      const { image_base64, image_type } = body;
      if (!image_base64 || !uploadPhoneId) {
        return new Response(JSON.stringify({ error: "Imagem e phone_number_id são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Decode base64 to binary
      const binaryStr = atob(image_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const fileSize = bytes.length;
      const mimeType = image_type || "image/jpeg";

      // Step 1: Create upload session
      const appId = Deno.env.get("META_APP_ID") || "";
      const createSessionRes = await fetch(
        `https://graph.facebook.com/v21.0/${appId}/uploads`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_length: fileSize,
            file_type: mimeType,
            file_name: "profile_photo.jpg",
          }),
        }
      );

      const sessionData = await createSessionRes.json();
      if (!createSessionRes.ok) {
        throw new Error(sessionData.error?.message || "Erro ao criar sessão de upload");
      }

      const uploadSessionId = sessionData.id;

      // Step 2: Upload the file
      const uploadRes = await fetch(
        `https://graph.facebook.com/v21.0/${uploadSessionId}`,
        {
          method: "POST",
          headers: {
            Authorization: `OAuth ${accessToken}`,
            file_offset: "0",
            "Content-Type": mimeType,
          },
          body: bytes,
        }
      );

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error?.message || "Erro ao fazer upload da imagem");
      }

      const handle = uploadData.h;

      // Step 3: Set profile picture using handle
      const setPhotoRes = await fetch(
        `https://graph.facebook.com/v21.0/${uploadPhoneId}/whatsapp_business_profile`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            profile_picture_handle: handle,
          }),
        }
      );

      const setPhotoData = await setPhotoRes.json();
      if (!setPhotoRes.ok) {
        throw new Error(setPhotoData.error?.message || "Erro ao definir foto de perfil");
      }

      return new Response(JSON.stringify({ success: true, data: setPhotoData }), {
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
