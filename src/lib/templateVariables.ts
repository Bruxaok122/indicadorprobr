import type { MetaTemplate } from "@/hooks/useMetaTemplates";

/**
 * Smart default mapping of template variables ({{1}}, {{2}}, ...) to contact
 * fields. Guesses from the words surrounding each variable in the template
 * body, with a deterministic fallback order for unmatched variables.
 */

export function getTemplateBodyText(template: MetaTemplate): string {
  const comps = (template.components ?? []) as Array<{ type: string; text?: string }>;
  return comps.find((c) => c.type === "BODY")?.text || "";
}

export function extractTemplateVariables(text: string): number[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => parseInt(m.replace(/[{}]/g, ""), 10)))].sort((a, b) => a - b);
}

/** Normalizes accents/lowercase so keyword rules can be written plainly. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Ordered keyword rules: first match wins. */
const KEYWORD_RULES: Array<[RegExp, string]> = [
  [/venc/, "vencimento"],
  [/final (do )?(cart|cc|card)|final cc/, "final_cc"],
  [/fatura atual|gasto|utilizad/, "gasto_utilizado"],
  [/processo|process\b/, "process_number"],
  [/\bcpf\b|\bc\.p\.f\b|documento|\bdoc\b/, "cpf"],
  [/causa/, "valor_da_causa"],
  [/parte contraria|\breu\b/, "lawyer_name"],
  [/advogad/, "advogado"],
  [/telefone|celular|whats/, "phone"],
  [/nome/, "name"],
];


/** Deterministic fallback for variables no keyword could match. */
const FALLBACK_ORDER = ["name", "process_number", "cpf", "phone", "vencimento", "final_cc", "gasto_utilizado", "valor_da_causa", "lawyer_name"];

const CONTEXT_WINDOW = 80;

export function guessVariableMappings(body: string): Record<string, string> {
  const vars = extractTemplateVariables(body);
  const used = new Set<string>();
  const result: Record<string, string> = {};

  // Pass 1: keyword guess from the text right before each variable.
  for (const v of vars) {
    const idx = body.indexOf(`{{${v}}}`);
    const start = Math.max(0, idx - CONTEXT_WINDOW);
    const context = normalize(body.slice(start, idx));
    for (const [re, field] of KEYWORD_RULES) {
      if (re.test(context)) {
        if (!used.has(field)) {
          result[String(v)] = field;
          used.add(field);
          break;
        }
        // Field already taken by another variable — try the next rule
      }
    }
  }

  // Pass 2: fallback order for anything still unmatched.
  for (const v of vars) {
    if (result[String(v)]) continue;
    const field = FALLBACK_ORDER.find((f) => !used.has(f));
    if (field) {
      result[String(v)] = field;
      used.add(field);
    }
  }

  return result;
}
