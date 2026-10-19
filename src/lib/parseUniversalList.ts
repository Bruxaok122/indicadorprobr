/**
 * Parser "universal" para listas no formato "Chave: Valor".
 * Separadores aceitos entre campos: "|", quebra de linha, ou 2+ espaços.
 * Um novo registro começa quando uma chave já vista no registro atual reaparece,
 * ou numa linha separadora (----, ====) / linha em branco dupla.
 */

export type UniversalTarget =
  | "name"
  | "phone"
  | "cpf"
  | "process_number"
  | "lawyer_name"
  | "valor_da_causa"
  | "vencimento"
  | "final_cc"
  | "gasto_utilizado"
  | "nome_completo"
  | "identificacao"
  | "extra"
  | "ignore";

// Somente estes campos entram na importação (pedido do usuário)
export const UNIVERSAL_TARGET_OPTIONS: { value: UniversalTarget; label: string }[] = [
  { value: "name", label: "Nome do Cliente" },
  { value: "phone", label: "Telefone" },
  { value: "vencimento", label: "📅 Vencimento (variável)" },
  { value: "final_cc", label: "💳 CC (variável)" },
  { value: "gasto_utilizado", label: "💸 Gasto (Utilizado) (variável)" },
  { value: "nome_completo", label: "🧾 Nome Completo (variável)" },
  { value: "identificacao", label: "🆔 Identificação (variável)" },
  { value: "ignore", label: "Ignorar" },
];

export type UniversalRecord = Record<string, string>;

export interface UniversalContact {
  name: string;
  phone: string;
  cpf?: string;
  process_number?: string;
  lawyer_name?: string;
  renda?: number;
  extra_data: Record<string, string>;
}

const strip = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Sugere o destino de uma chave pelo nome. */
export function guessTarget(key: string): UniversalTarget {
  const k = strip(key);
  if (/^nome completo$/.test(k)) return "nome_completo";
  if (/(identifica|^id$)/.test(k)) return "identificacao";
  if (/^(nome|cliente|nome completo|requerente|autor)$/.test(k) || k.startsWith("nome do cliente")) return "name";
  if (/(celular|telefone|fone|whats|tel\b|contato)/.test(k)) return "phone";
  if (/(venc)/.test(k)) return "vencimento";
  if (/(^cc$|final\s*(do\s*)?(cc|cartao|credito)|4\s*ultimos|^cartao)/.test(k)) return "final_cc";
  if (/(gasto|utilizado)/.test(k)) return "gasto_utilizado";
  return "ignore";
}

const KEY_RE = /(?:^|\||\n|\s{2,})\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 ._\/()º°-]{0,40}?)\s*:(?!\/\/)/g;
const SEPARATOR_RE = /^\s*[-=_*]{5,}\s*$/gm;

/** Extrai registros brutos (chave → valor). */
export function parseUniversalRecords(raw: string): UniversalRecord[] {
  const text = raw.replace(/\r/g, "").replace(SEPARATOR_RE, "\n\u0000\n").replace(/\n\s*\n\s*\n/g, "\n\u0000\n");
  const records: UniversalRecord[] = [];

  for (const chunk of text.split("\u0000")) {
    const hits: { key: string; start: number; valueStart: number }[] = [];
    KEY_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = KEY_RE.exec(chunk))) {
      const key = m[1].trim();
      // Evita interpretar horários (ex.: "10:30") como chave
      if (/^\d/.test(key)) continue;
      hits.push({ key, start: m.index, valueStart: m.index + m[0].length });
    }
    let current: UniversalRecord = {};
    hits.forEach((h, i) => {
      const end = i + 1 < hits.length ? hits[i + 1].start : chunk.length;
      const value = chunk.slice(h.valueStart, end).replace(/^[\s|]+|[\s|]+$/g, "").trim();
      const normKey = h.key.toUpperCase();
      if (normKey in current) {
        records.push(current);
        current = {};
      }
      current[normKey] = value;
    });
    if (Object.keys(current).length) records.push(current);
  }
  return records;
}

/** Normaliza celular BR → 55 + DDD + 9XXXXXXXX. Retorna null para fixo/inválido. */
export function normalizeBrMobile(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 10 && /[6-9]/.test(d[2])) d = d.slice(0, 2) + "9" + d.slice(2);
  if (d.length !== 11 || d[2] !== "9") return null;
  return "55" + d;
}

function parseMoney(v: string): number | undefined {
  const s = v.replace(/[^\d,.-]/g, "");
  if (!s) return undefined;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Mascara o cartão: 6 primeiros + XXXXXX + 4 últimos (ex.: 123456XXXXXX8620).
 * Com menos de 10 dígitos só os 4 últimos são conhecidos. Valores em dinheiro são rejeitados.
 */
export function maskCard(value: string): string | null {
  if (/R\$|\d,\d{2}\b/.test(value)) return null;
  const d = value.replace(/\D/g, "");
  if (d.length >= 10) return d.slice(0, 6) + "XXXXXX" + d.slice(-4);
  if (d.length >= 4) return d.slice(-4);
  return null;
}

/** Converte registros em contatos usando o mapeamento escolhido. */
export function buildUniversalContacts(
  records: UniversalRecord[],
  mapping: Record<string, UniversalTarget>,
): { contacts: UniversalContact[]; errors: string[] } {
  const contacts: UniversalContact[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  records.forEach((rec, idx) => {
    const base: Omit<UniversalContact, "phone"> = { name: "", extra_data: {} };
    const phones: string[] = [];
    for (const [key, value] of Object.entries(rec)) {
      const target = mapping[key] ?? "ignore";
      if (target === "ignore" || !value) continue;
      switch (target) {
        case "name": base.name = base.name || value; break;
        case "phone":
          value.split(/[,;/]| e /).forEach((p) => { const n = normalizeBrMobile(p); if (n) phones.push(n); });
          break;
        case "cpf": base.cpf = value.replace(/\D/g, "") || value; break;
        case "process_number": base.process_number = value; break;
        case "lawyer_name": base.lawyer_name = value; break;
        case "valor_da_causa": base.renda = parseMoney(value); break;
        case "extra": base.extra_data[key] = value; break;
        case "vencimento": base.extra_data["VENCIMENTO"] = value; break;
        case "final_cc": {
          // Final do cartão: só os 4 últimos dígitos; ignora valores em dinheiro
          if (/R\$|\d,\d{2}\b/.test(value)) break;
          const digits = value.replace(/\D/g, "");
          if (base.extra_data["CC"]) break;
          const masked = maskCard(value);
          if (masked) base.extra_data["CC"] = masked;
          break;
        }
        case "gasto_utilizado": base.extra_data["GASTO (UTILIZADO)"] = value; break;
        case "nome_completo": base.extra_data["NOME COMPLETO"] = value; break;
        case "identificacao": base.extra_data["IDENTIFICAÇÃO"] = value; break;
      }
    }
    const label = base.name || `Registro ${idx + 1}`;
    if (!base.name) { errors.push(`${label}: sem nome`); return; }
    if (phones.length === 0) { errors.push(`${label}: nenhum celular válido`); return; }
    for (const phone of phones) {
      if (seen.has(phone)) continue;
      seen.add(phone);
      contacts.push({ ...base, phone });
    }
  });
  return { contacts, errors };
}
