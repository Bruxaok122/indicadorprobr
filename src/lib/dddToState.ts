/**
 * Mapeamento de DDDs brasileiros para estados (UF)
 */
const dddToStateMap: Record<string, string> = {
  // São Paulo
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP",
  "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  // Rio de Janeiro
  "21": "RJ", "22": "RJ", "24": "RJ",
  // Espírito Santo
  "27": "ES", "28": "ES",
  // Minas Gerais
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG",
  "37": "MG", "38": "MG",
  // Paraná
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  // Santa Catarina
  "47": "SC", "48": "SC", "49": "SC",
  // Rio Grande do Sul
  "51": "RS", "52": "RS", "53": "RS", "54": "RS", "55": "RS",
  // Distrito Federal
  "61": "DF",
  // Goiás
  "62": "GO", "64": "GO",
  // Tocantins
  "63": "TO",
  // Mato Grosso do Sul
  "67": "MS",
  // Mato Grosso
  "65": "MT", "66": "MT",
  // Acre
  "68": "AC",
  // Rondônia
  "69": "RO",
  // Bahia
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  // Sergipe
  "79": "SE",
  // Pernambuco
  "81": "PE", "87": "PE",
  // Alagoas
  "82": "AL",
  // Paraíba
  "83": "PB",
  // Rio Grande do Norte
  "84": "RN",
  // Ceará
  "85": "CE", "88": "CE",
  // Piauí
  "86": "PI", "89": "PI",
  // Maranhão
  "98": "MA", "99": "MA",
  // Pará
  "91": "PA", "93": "PA", "94": "PA",
  // Amazonas
  "92": "AM", "97": "AM",
  // Roraima
  "95": "RR",
  // Amapá
  "96": "AP",
};

/**
 * Extrai o DDD de um telefone normalizado (formato 55DXXXXXXXXX)
 */
export function extractDDD(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 4) {
    return digits.substring(2, 4);
  }
  return null;
}

/**
 * Retorna a sigla do estado (UF) a partir de um DDD
 */
export function getStateFromDDD(ddd: string): string {
  return dddToStateMap[ddd] || "Outros";
}

/**
 * Retorna a sigla do estado a partir de um número de telefone
 */
export function getStateFromPhone(phone: string): string {
  const ddd = extractDDD(phone);
  if (!ddd) return "Outros";
  return getStateFromDDD(ddd);
}
