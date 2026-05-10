// Validates a batch of phone numbers against the external WhatsApp existence API.
// Runs requests with high concurrency for speed.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_BASE =
  "https://supremodoseteoriginal.com/?action=verificar_whatsapp&telefone=";

const CONCURRENCY = 25;
const TIMEOUT_MS = 8000;

async function checkOne(phone: string): Promise<boolean> {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE + digits, { signal: ctrl.signal });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    if (!data) return false;
    // success + whatsapp boolean
    return data.whatsapp === true || data?.raw?.whatsapp === true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { phones } = await req.json();
    if (!Array.isArray(phones)) {
      return new Response(JSON.stringify({ error: "phones must be array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, boolean> = {};
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, phones.length) }, async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= phones.length) break;
        const phone = phones[idx];
        results[phone] = await checkOne(phone);
      }
    });
    await Promise.all(workers);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
