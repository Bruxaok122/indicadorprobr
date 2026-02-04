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
 * Extrai telefones de uma string (pode ter múltiplos separados por vírgula)
 */
function extractPhones(text: string): string[] {
  // Pattern para telefones brasileiros: (XX) XXXXX-XXXX ou variações
  const phonePattern = /\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/g;
  const matches = text.match(phonePattern) || [];
  
  return matches
    .map(phone => normalizePhone(phone))
    .filter(phone => phone.length >= 12 && phone.length <= 13);
}

/**
 * Verifica se uma linha é uma mensagem a ser ignorada
 * (começa com "Bom dia", "Boa tarde", etc. ou parece mensagem pronta)
 */
function isMessageLine(line: string): boolean {
  const messagePatterns = [
    /^[""]?Bom dia/i,
    /^[""]?Boa tarde/i,
    /^[""]?Boa noite/i,
    /^Estou entrando em contato/i,
    /colocar meu escritório/i,
    /esclarecer dúvidas/i,
    /próximos passos/i,
    /^[""]?\(\d{7}/,  // Começa com número do processo entre parênteses
  ];
  
  return messagePatterns.some(pattern => pattern.test(line.trim()));
}

/**
 * Verifica se uma linha contém um número de processo
 */
function isProcessLine(line: string): boolean {
  // Formato: 1234567-89.2024.8.26.0627
  return /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/.test(line);
}

/**
 * Extrai o número do processo de uma linha
 */
function extractProcess(line: string): string | null {
  const match = line.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
  return match ? match[1] : null;
}

/**
 * Faz o parse de um bloco individual da lista jurídica (novo formato)
 */
function parseBlockNewFormat(block: string): ParsedBlock | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 3) {
    return null;
  }

  let lawyer = "Não informado";
  let process = "Não informado";
  let clientName = "Cliente";
  const phones: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Ignorar linhas de mensagem
    if (isMessageLine(line)) {
      continue;
    }

    // Extrair advogado
    if (line.toUpperCase().startsWith("ADVOGADO:") || line.toUpperCase().startsWith("ADVOGADO ")) {
      // Advogado pode estar na mesma linha após ":"
      const afterColon = line.split(":").slice(1).join(":").trim();
      if (afterColon) {
        lawyer = afterColon;
      }
    } else if (line.includes("⚖️ Advogado")) {
      // Formato com emoji
      const afterColon = line.split(":").slice(1).join(":").trim();
      if (afterColon) {
        lawyer = afterColon;
      }
    }

    // Extrair processo
    if (line.toUpperCase().startsWith("PROCESSO:") || line.toUpperCase().startsWith("PROCESSO ")) {
      const extracted = extractProcess(line);
      if (extracted) {
        process = extracted;
      } else {
        const afterColon = line.split(":").slice(1).join(":").trim();
        if (afterColon && afterColon !== "(não disponíveis nesta etapa)") {
          process = afterColon;
        }
      }
    } else if (isProcessLine(line)) {
      const extracted = extractProcess(line);
      if (extracted) {
        process = extracted;
      }
    }

    // Extrair nome do cliente (linha com 👤 Nome:)
    if (line.includes("👤 Nome:") || line.includes("👤Nome:")) {
      const afterColon = line.split(":").slice(1).join(":").trim();
      if (afterColon) {
        clientName = afterColon;
      }
    }

    // Extrair telefones (linha com 📞 Telefones:)
    if (line.includes("📞 Telefones:") || line.includes("📞Telefones:")) {
      const afterColon = line.split(":").slice(1).join(":").trim();
      if (afterColon && !afterColon.includes("não disponíveis")) {
        const extractedPhones = extractPhones(afterColon);
        phones.push(...extractedPhones);
      }
    }
    // Também tentar extrair telefones de linhas que parecem ter formato de telefone
    else if (/\(\d{2}\)\s*\d{4,5}[-.\s]?\d{4}/.test(line) && !line.includes("não disponíveis")) {
      const extractedPhones = extractPhones(line);
      phones.push(...extractedPhones);
    }
  }

  // Remover duplicatas de telefones
  const uniquePhones = [...new Set(phones)];

  if (uniquePhones.length === 0) {
    return null;
  }

  return {
    lawyer,
    process,
    clientName,
    phones: uniquePhones,
  };
}

/**
 * Faz o parse de um bloco individual da lista jurídica (formato antigo)
 */
function parseBlockOldFormat(block: string): ParsedBlock | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 4) {
    return null;
  }

  let lawyerIndex = lines.findIndex((line) => line.toUpperCase().includes("ADVOGADO"));
  let processIndex = lines.findIndex((line) => line.toUpperCase().includes("PROCESSO"));

  if (lawyerIndex === -1 || processIndex === -1) {
    if (lines.length >= 4) {
      const phonesFromBlock = lines.slice(3).filter(line => {
        const digits = line.replace(/\D/g, "");
        return digits.length >= 8 && digits.length <= 15;
      }).map(normalizePhone);
      
      if (phonesFromBlock.length > 0) {
        return {
          lawyer: lines[0] || "Não informado",
          process: lines[1] || "Não informado",
          clientName: lines[2] || "Cliente",
          phones: phonesFromBlock,
        };
      }
    }
    return null;
  }

  const lawyer = lines[lawyerIndex + 1] || "Não informado";
  const process = lines[processIndex + 1] || "Não informado";

  const clientNameIndex = processIndex + 2;
  const clientName = lines[clientNameIndex] || "Cliente";

  const phones = lines
    .slice(clientNameIndex + 1)
    .filter(line => {
      const digits = line.replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15;
    })
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
 * Detecta qual formato usar e faz parse do bloco
 */
function parseBlock(block: string): ParsedBlock | null {
  // Detectar novo formato (contém emojis ou "👤 Nome:")
  const isNewFormat = block.includes("👤") || block.includes("📞") || block.includes("⚖️");
  
  if (isNewFormat) {
    return parseBlockNewFormat(block);
  }
  
  return parseBlockOldFormat(block);
}

/**
 * Faz o parse completo da lista jurídica
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
      // Só adiciona erro se o bloco não for uma mensagem ignorada
      if (!isMessageLine(rawBlock.trim().split('\n')[0] || '')) {
        errors.push(`Bloco ${index + 1}: Formato inválido ou incompleto`);
      }
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
