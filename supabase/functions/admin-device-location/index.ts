import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !anonKey || !serviceKey || !authorization?.startsWith("Bearer ")) return reply(401, { error: "Unauthorized" });
    const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: user, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !user.user) return reply(401, { error: "Unauthorized" });
    // This RPC validates role AND active administrative session; the IP comes from Auth, never request input.
    const { data: context, error } = await client.rpc("admin_location_context");
    if (error || !context?.computer_id) return reply(403, { error: "Forbidden" });
    if (context.cached || !context.ip) return reply(200, { available: Boolean(context.cached) });
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(context.ip)}`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return reply(200, { available: false });
    const result = await response.json();
    if (result.success !== true) return reply(200, { available: false });
    const safeText = (value: unknown) => typeof value === "string" ? value.slice(0, 100) : "";
    const location = { city: safeText(result.city), region: safeText(result.region), country: safeText(result.country), updated_at: new Date().toISOString(), source: "IP" };
    const service = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { error: saveError } = await service.rpc("save_admin_device_location", { p_computer_id: context.computer_id, p_location: location });
    if (saveError) return reply(200, { available: false });
    return reply(200, { available: true });
  } catch {
    // Do not log IPs, tokens, or provider responses. Location is nonessential.
    return reply(200, { available: false });
  }
});