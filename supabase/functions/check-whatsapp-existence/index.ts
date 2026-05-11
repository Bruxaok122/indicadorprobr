// Validates a batch of phone numbers against the external WhatsApp existence API.
// Never converts API/network failures into "no WhatsApp" results: failures stay inconclusive.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_BASE =
  "https://supremodoseteoriginal.com/?action=verificar_whatsapp&telefone=";

const CONCURRENCY = 12;
const TIMEOUT_MS = 12000;

type CheckStatus = "has_whatsapp" | "no_whatsapp" | "unknown" | "invalid_format";

interface CheckResult {
  phone: string;
  queryPhone: string;
  exists: boolean | null;
  status: CheckStatus;
  reason: string;
  httpStatus?: number;
  apiStatus?: string;
  message?: string;
}

function normalizePhone(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits.startsWith("55") && digits.length <= 11) digits = `55${digits}`;
  return digits;
}

function toApiPhone(normalized: string): string {
  // The supplied API example uses DDD + number (13988070030), not 55 + DDD + number.
  if (normalized.startsWith("55") && (normalized.length === 12 || normalized.length === 13)) {
    return normalized.slice(2);
  }
  return normalized;
}

function interpretApiPayload(phone: string, queryPhone: string, httpStatus: number, data: any): CheckResult {
  const whatsapp = data?.whatsapp ?? data?.raw?.whatsapp;
  const statusText = String(data?.status ?? data?.raw?.status ?? "").toLowerCase();
  const message = String(data?.mensagem ?? data?.message ?? data?.raw?.mensagem ?? "");
  const messageLower = message.toLowerCase();

  if (whatsapp === true || statusText === "existe" || messageLower.includes("possui whatsapp")) {
    return {
      phone,
      queryPhone,
      exists: true,
      status: "has_whatsapp",
      reason: "WhatsApp confirmado pela API",
      httpStatus,
      apiStatus: statusText || undefined,
      message: message || undefined,
    };
  }

  if (
    whatsapp === false ||
    ["nao_existe", "não_existe", "inexistente", "sem_whatsapp", "nao possui whatsapp", "não possui whatsapp"].some((s) =>
      statusText.includes(s) || messageLower.includes(s),
    )
  ) {
    return {
      phone,
      queryPhone,
      exists: false,
      status: "no_whatsapp",
      reason: "API confirmou que o número não possui WhatsApp",
      httpStatus,
      apiStatus: statusText || undefined,
      message: message || undefined,
    };
  }

  return {
    phone,
    queryPhone,
    exists: null,
    status: "unknown",
    reason: "Resposta da API sem confirmação conclusiva",
    httpStatus,
    apiStatus: statusText || undefined,
    message: message || undefined,
  };
}

async function checkOne(phone: string): Promise<CheckResult> {
  const normalized = normalizePhone(phone);
  if (normalized.length !== 13 || normalized[4] !== "9") {
    return {
      phone: normalized || String(phone || ""),
      queryPhone: normalized,
      exists: null,
      status: "invalid_format",
      reason: "Formato inválido para celular brasileiro",
    };
  }

  const queryPhone = toApiPhone(normalized);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE + encodeURIComponent(queryPhone), {
      signal: ctrl.signal,
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 JurisZap Validator" },
    });
    if (!res.ok) {
      return {
        phone: normalized,
        queryPhone,
        exists: null,
        status: "unknown",
        reason: `API retornou HTTP ${res.status}`,
        httpStatus: res.status,
      };
    }
    const data = await res.json().catch(() => null);
    if (!data) {
      return {
        phone: normalized,
        queryPhone,
        exists: null,
        status: "unknown",
        reason: "Resposta da API não é JSON válido",
        httpStatus: res.status,
      };
    }
    return interpretApiPayload(normalized, queryPhone, res.status, data);
  } catch (err) {
    return {
      phone: normalized,
      queryPhone,
      exists: null,
      status: "unknown",
      reason: err instanceof Error && err.name === "AbortError" ? "Tempo esgotado ao consultar a API" : "Falha de conexão com a API",
    };
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
    const statuses: Record<string, CheckResult> = {};
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, phones.length) }, async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= phones.length) break;
        const inputPhone = String(phones[idx] || "");
        const checked = await checkOne(inputPhone);
        const key = normalizePhone(inputPhone) || inputPhone;
        statuses[key] = checked;
        results[key] = checked.status === "has_whatsapp";
      }
    });
    await Promise.all(workers);

    const values = Object.values(statuses);
    const summary = {
      total: values.length,
      confirmed: values.filter((r) => r.status === "has_whatsapp").length,
      notWhatsapp: values.filter((r) => r.status === "no_whatsapp").length,
      unknown: values.filter((r) => r.status === "unknown").length,
      invalid: values.filter((r) => r.status === "invalid_format").length,
    };

    return new Response(JSON.stringify({ results, statuses, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
