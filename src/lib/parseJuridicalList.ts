import { ParsedBlock, ParsedContact } from "@/types/juriszap";

const SEPARATOR = "================================================================================";

/**
 * Normaliza número de telefone para formato brasileiro (55 + DDD + número)
 */
function normalizePhone(phone: string): string {
  // Remove tudo que não é número
  const digits = phone.replace(/\D/g, "");

  // Se já tem 13 dígitos (55 + DDD + 9 dígitos), retorna
  if (digits.length === 13 && digits.startsWith("55")) {
    return digits;
  }

  // Se tem 12 dígitos (55 + DDD + 8 dígitos), adiciona 9 após DDD
  if (digits.length === 12 && digits.startsWith("55")) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }

  // Se tem 11 dígitos (DDD + 9 + número)
  if (digits.length === 11) {
    return "55" + digits;
  }

  // Se tem 10 dígitos (DDD + número sem 9)
  if (digits.length === 10) {
    return "55" + digits.slice(0, 2) + "9" + digits.slice(2);
  }

  // Se tem 9 dígitos (número com 9, sem DDD) - assume DDD 11
  if (digits.length === 9) {
    return "5511" + digits;
  }

  // Se tem 8 dígitos (número sem 9 e sem DDD) - assume DDD 11
  if (digits.length === 8) {
    return "55119" + digits;
  }

  // Retorna original se não conseguir normalizar
  return digits;
}

/**
 * Verifica se uma string parece ser um número de telefone
 */
function isPhoneLine(line: string): boolean {
  const digits = line.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Faz o parse de um bloco individual da lista jurídica
 */
function parseBlock(block: string): ParsedBlock | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 4) {
    return null;
  }

  // Primeira linha: ADVOGADO (label)
  // Segunda linha: nome do advogado
  // Terceira linha: PROCESSO (label)
  // Quarta linha: número do processo
  // Quinta linha: nome do cliente
  // Linhas seguintes: telefones

  let lawyerIndex = lines.findIndex((line) => line.toUpperCase().includes("ADVOGADO"));
  let processIndex = lines.findIndex((line) => line.toUpperCase().includes("PROCESSO"));

  // Se não encontrou os labels, tenta inferir a estrutura
  if (lawyerIndex === -1 || processIndex === -1) {
    // Estrutura alternativa: assume que a primeira linha é advogado, segunda é processo
    if (lines.length >= 4) {
      return {
        lawyer: lines[0] || "Não informado",
        process: lines[1] || "Não informado",
        clientName: lines[2] || "Cliente",
        phones: lines.slice(3).filter(isPhoneLine).map(normalizePhone),
      };
    }
    return null;
  }

  const lawyer = lines[lawyerIndex + 1] || "Não informado";
  const process = lines[processIndex + 1] || "Não informado";

  // Nome do cliente vem após o processo
  const clientNameIndex = processIndex + 2;
  const clientName = lines[clientNameIndex] || "Cliente";

  // Telefones são as linhas restantes que parecem números
  const phones = lines
    .slice(clientNameIndex + 1)
    .filter(isPhoneLine)
    .map(normalizePhone);

  if (phones.length === 0) {
    return null;
  }

  return {
    lawyer,
    process,
    clientName,
    phones,
  };
}

/**
 * Faz o parse completo da lista jurídica
 * Formato esperado:
 * ================================================================================
 * ADVOGADO
 * Nome do Advogado
 * PROCESSO
 * Número do Processo
 * Nome do Cliente
 * (11) 99999-9999
 * ================================================================================
 */
export function parseJuridicalList(rawText: string): {
  contacts: ParsedContact[];
  errors: string[];
  blocks: ParsedBlock[];
} {
  const errors: string[] = [];
  const blocks: ParsedBlock[] = [];
  const contacts: ParsedContact[] = [];

  // Divide o texto pelos separadores
  const rawBlocks = rawText.split(SEPARATOR).filter((block) => block.trim().length > 0);

  if (rawBlocks.length === 0) {
    // Tenta parsear sem separador (formato simples)
    const parsed = parseBlock(rawText);
    if (parsed && parsed.phones.length > 0) {
      blocks.push(parsed);
      parsed.phones.forEach((phone) => {
        contacts.push({
          name: parsed.clientName,
          phone,
          lawyer_name: parsed.lawyer,
          process_number: parsed.process,
        });
      });
    } else {
      errors.push("Nenhum bloco válido encontrado. Verifique o formato da lista.");
    }
    return { contacts, errors, blocks };
  }

  rawBlocks.forEach((rawBlock, index) => {
    const parsed = parseBlock(rawBlock);

    if (!parsed) {
      errors.push(`Bloco ${index + 1}: Formato inválido ou incompleto`);
      return;
    }

    if (parsed.phones.length === 0) {
      errors.push(`Bloco ${index + 1}: Nenhum telefone encontrado`);
      return;
    }

    blocks.push(parsed);

    // Cria um contato para cada telefone
    parsed.phones.forEach((phone) => {
      contacts.push({
        name: parsed.clientName,
        phone,
        lawyer_name: parsed.lawyer,
        process_number: parsed.process,
      });
    });
  });

  return { contacts, errors, blocks };
}

/**
 * Valida se o texto parece ser uma lista jurídica válida
 */
export function validateJuridicalList(rawText: string): {
  isValid: boolean;
  message: string;
} {
  if (!rawText || rawText.trim().length === 0) {
    return { isValid: false, message: "Cole a lista de contatos no campo acima" };
  }

  const { contacts, errors } = parseJuridicalList(rawText);

  if (contacts.length === 0) {
    return {
      isValid: false,
      message: errors.length > 0 ? errors[0] : "Nenhum contato válido encontrado",
    };
  }

  return {
    isValid: true,
    message: `${contacts.length} contato(s) encontrado(s)`,
  };
}
