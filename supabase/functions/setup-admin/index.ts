 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     const email = "admin@juriszap.com";
     const password = "JurisZap@2025!";
 
     // Check if admin already exists
     const { data: existingProfiles } = await supabase
       .from("profiles")
       .select("id")
       .eq("email", email);
 
     if (existingProfiles && existingProfiles.length > 0) {
       return new Response(
         JSON.stringify({ error: "Admin user already exists" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Create auth user
     const { data: authData, error: authError } = await supabase.auth.admin.createUser({
       email,
       password,
       email_confirm: true,
     });
 
     if (authError) {
       throw new Error(authError.message);
     }
 
     const userId = authData.user.id;
 
     // Create profile
     const { error: profileError } = await supabase.from("profiles").insert({
       user_id: userId,
       full_name: "Administrador",
       email,
       can_use_shared_api: true,
       is_blocked: false,
     });
 
     if (profileError) {
       await supabase.auth.admin.deleteUser(userId);
       throw new Error(profileError.message);
     }
 
     // Create admin role
     const { error: roleError } = await supabase.from("user_roles").insert({
       user_id: userId,
       role: "admin",
     });
 
     if (roleError) {
       console.error("Error creating role:", roleError);
     }
 
     return new Response(
       JSON.stringify({ 
         success: true, 
         message: "Admin user created successfully",
         credentials: { email, password }
       }),
       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error: unknown) {
     console.error("Error creating admin:", error);
     const errorMessage = error instanceof Error ? error.message : "Unknown error";
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });