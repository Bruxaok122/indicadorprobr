import { ParsedBlock, ParsedContact } from "@/types/juriszap";

const SEPARATOR_EQUALS = "================================================================================";
const SEPARATOR_DASHES = /^-{10,}$/;

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

  // Se tem 12 dígitos (55 + DDD + 8 dígitos) = FIXO, ignorar
  if (digits.length === 12 && digits.startsWith("55")) {
    return ""; // Telefone fixo, não pode usar WhatsApp
  }

  // Se tem 11 dígitos (DDD + 9 + número)
  if (digits.length === 11) {
    return "55" + digits;
  }

  // Se tem 10 dígitos (DDD + número sem 9) = FIXO, ignorar
  if (digits.length === 10) {
    return ""; // Telefone fixo, não pode usar WhatsApp
  }

  // Se tem 9 dígitos (número com 9, sem DDD) - assume DDD 11
  if (digits.length === 9) {
    return "5511" + digits;
  }

  // Se tem 8 dígitos (número fixo sem DDD) - FIXO, ignorar
  if (digits.length === 8) {
    return ""; // Telefone fixo, não pode usar WhatsApp
  }

  // Retorna original se não conseguir normalizar
  return digits;
}

/**
 * Verifica se um número normalizado (55+DDD+número) é celular
 * Celulares brasileiros têm 9 dígitos após o DDD (começando com 9)
 */
function isMobileNumber(normalized: string): boolean {
  if (normalized.length !== 13) return false;
  // 55 + 2 DDD + 9 dígitos, o primeiro dígito após DDD deve ser 9
  return normalized[4] === "9";
}

/**
 * Extrai telefones de uma string (pode ter múltiplos separados por vírgula)
 * Filtra apenas números celulares (WhatsApp não funciona em fixo)
 */
function extractPhones(text: string): string[] {
  // Pattern para telefones brasileiros: (XX) XXXXX-XXXX ou variações
  const phonePattern = /\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/g;
  const matches = text.match(phonePattern) || [];
  
  return matches
    .map(phone => normalizePhone(phone))
    .filter(phone => phone.length === 13 && isMobileNumber(phone));
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

  let lawyer = "********";
  let process = "0031486-26.2025.8.26.0002";
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
          lawyer: lines[0] || "********",
          process: lines[1] || "0031486-26.2025.8.26.0002",
          clientName: lines[2] || "Cliente",
          phones: phonesFromBlock,
        };
      }
    }
    return null;
  }

  const lawyer = lines[lawyerIndex + 1] || "********";
  const process = lines[processIndex + 1] || "0031486-26.2025.8.26.0002";

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
 * Parse do novo formato com separador "---" e campos NOME/CPF/TELEFONE/contra/np
 */
function parseBlockDashFormat(block: string): ParsedBlock | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !SEPARATOR_DASHES.test(line));

  if (lines.length < 2) return null;

  let clientName = "Cliente";
  let cpf: string | undefined;
  let renda: string | undefined;
  let contra: string | undefined;
  let process = "0031486-26.2025.8.26.0002";
  const phones: string[] = [];

  for (const line of lines) {
    // NOME: FABIO ALMEIDA CECILIO  - renda $627,49
    if (/^NOME:/i.test(line)) {
      let afterColon = line.replace(/^NOME:\s*/i, "").trim();
      // Extract renda if present
      const rendaMatch = afterColon.match(/\s*-\s*renda\s+\$?([\d.,]+)/i);
      if (rendaMatch) {
        renda = rendaMatch[1];
        afterColon = afterColon.replace(/\s*-\s*renda\s+\$?[\d.,]+/i, "").trim();
      }
      if (afterColon) clientName = afterColon;
    }
    // CPF: 45560170178
    else if (/^CPF:/i.test(line)) {
      cpf = line.replace(/^CPF:\s*/i, "").trim() || undefined;
    }
    // TELEFONE: +5564992414335,+5564992836971
    else if (/^TELEFONE:/i.test(line)) {
      const raw = line.replace(/^TELEFONE:\s*/i, "").trim();
      const parts = raw.split(",").map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        const normalized = normalizePhone(part);
        if (normalized.length === 13 && isMobileNumber(normalized)) {
          phones.push(normalized);
        }
      }
    }
    // contra: Instituto Nacional do Seguro Social
    else if (/^contra:/i.test(line)) {
      contra = line.replace(/^contra:\s*/i, "").trim() || undefined;
    }
    // np: or PROCESSO:
    else if (/^np:/i.test(line)) {
      process = line.replace(/^np:\s*/i, "").trim() || "Não informado";
    }
    else if (/^PROCESSO:/i.test(line)) {
      const extracted = extractProcess(line);
      if (extracted) {
        process = extracted;
      } else {
        process = line.replace(/^PROCESSO:\s*/i, "").trim() || "Não informado";
      }
    }
  }

  const uniquePhones = [...new Set(phones)];
  if (uniquePhones.length === 0) return null;

  return {
    lawyer: contra || "********",
    process,
    clientName,
    phones: uniquePhones,
    cpf,
    renda,
    contra,
  };
}

/**
 * Parse do formato POLO ATIVO/PASSIVO (Tribunal completo)
 * Retorna múltiplos blocks - um por pessoa com telefone celular
 */
function parseBlockPoloFormat(block: string): ParsedBlock[] {
  const lines = block.split("\n").map((l) => l.trim());

  // Processo
  let process = "0031486-26.2025.8.26.0002";
  const procLine = lines.find((l) => /^PROCESSO:/i.test(l));
  if (procLine) {
    const extracted = extractProcess(procLine);
    process = extracted || procLine.replace(/^PROCESSO:\s*/i, "").trim() || process;
  }

  // Split em seções POLO ATIVO / POLO PASSIVO
  interface Person {
    name: string;
    cpf?: string;
    renda?: string;
    phones: string[];
  }
  interface Polo {
    people: Person[];
    lawyer?: string;
  }

  const polos: { ativo: Polo; passivo: Polo } = {
    ativo: { people: [] },
    passivo: { people: [] },
  };

  let currentPoloKey: "ativo" | "passivo" | null = null;
  let currentPerson: Person | null = null;
  let inTelefones = false;

  const flushPerson = () => {
    if (currentPerson && currentPoloKey) {
      polos[currentPoloKey].people.push(currentPerson);
    }
    currentPerson = null;
    inTelefones = false;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/^POLO ATIVO:/i.test(line)) {
      flushPerson();
      currentPoloKey = "ativo";
      continue;
    }
    if (/^POLO PASSIVO:/i.test(line)) {
      flushPerson();
      currentPoloKey = "passivo";
      continue;
    }
    if (!currentPoloKey) continue;

    // NOME começa novo pessoa
    const nomeMatch = line.match(/^-?\s*NOME:\s*(.+)$/i);
    if (nomeMatch) {
      flushPerson();
      currentPerson = { name: nomeMatch[1].trim(), phones: [] };
      continue;
    }
    if (!currentPerson) continue;

    const docMatch = line.match(/^-?\s*DOC:\s*(.+)$/i);
    if (docMatch) {
      const doc = docMatch[1].replace(/\D/g, "");
      // CPF = 11 dígitos; CNPJ = 14 → só grava se CPF
      if (doc.length === 11) currentPerson.cpf = doc;
      inTelefones = false;
      continue;
    }
    const rendaMatch = line.match(/^-?\s*RENDA:\s*R?\$?\s*([\d.,]+)/i);
    if (rendaMatch) {
      currentPerson.renda = rendaMatch[1];
      inTelefones = false;
      continue;
    }
    if (/^-?\s*IDADE:/i.test(line)) { inTelefones = false; continue; }
    if (/^-?\s*TELEFONES?:/i.test(line)) { inTelefones = true; continue; }

    // Linha de advogado do polo — encerra a pessoa atual e associa ao polo
    if (/^-?\s*ADVOGADO:/i.test(line)) {
      const adv = line.replace(/^-?\s*ADVOGADO:\s*/i, "").trim();
      // Pega o primeiro nome antes de "(CPF" ou ";"
      const firstName = adv.split(/\(|;/)[0].trim();
      polos[currentPoloKey].lawyer = firstName || adv;
      flushPerson();
      continue;
    }

    // Linhas de telefone
    if (inTelefones) {
      const extracted = extractPhones(line);
      if (extracted.length > 0) currentPerson.phones.push(...extracted);
    }
  }
  flushPerson();

  // Constrói ParsedBlocks apenas para pessoas do POLO ATIVO.
  // A Parte Contrária é preenchida com o primeiro nome do POLO PASSIVO.
  const result: ParsedBlock[] = [];
  const parteContrariaName = polos.passivo.people[0]?.name || "********";

  polos.ativo.people.forEach((person) => {
    const uniquePhones = [...new Set(person.phones)];
    if (uniquePhones.length === 0) return;
    result.push({
      lawyer: parteContrariaName,
      process,
      clientName: person.name,
      phones: uniquePhones,
      cpf: person.cpf,
      renda: person.renda,
      contra: parteContrariaName,
    });
  });

  return result;
}

/**
 * Detecta qual formato usar e faz parse do bloco
 * Retorna array pois alguns formatos geram múltiplos blocos por bloco de texto.
 */
function parseBlock(block: string): ParsedBlock[] {
  // Polo format (Tribunal completo)
  if (/POLO ATIVO:/i.test(block) || /POLO PASSIVO:/i.test(block)) {
    return parseBlockPoloFormat(block);
  }

  // Detect dash format (has NOME: / TELEFONE: / np: fields)
  if (/^NOME:/im.test(block) || /^TELEFONE:/im.test(block) || /^np:/im.test(block) || (/^CPF:/im.test(block) && /^CONTRA:/im.test(block))) {
    const b = parseBlockDashFormat(block);
    return b ? [b] : [];
  }

  // Detectar novo formato (contém emojis ou "👤 Nome:")
  const isNewFormat = block.includes("👤") || block.includes("📞") || block.includes("⚖️");

  if (isNewFormat) {
    const b = parseBlockNewFormat(block);
    return b ? [b] : [];
  }

  const b = parseBlockOldFormat(block);
  return b ? [b] : [];
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
  const usedPhones = new Set<string>();

  // Divide o texto pelos separadores (equals ou dashes)
  const hasDashSeparator = /^-{10,}$/m.test(rawText);
  const rawBlocks = hasDashSeparator
    ? rawText.split(/\n?-{10,}\n?/).filter((block) => block.trim().length > 0)
    : rawText.split(SEPARATOR_EQUALS).filter((block) => block.trim().length > 0);

  const addContactsFromBlock = (parsed: ParsedBlock) => {
    // Deduplicate: skip phones already used by a previous block
    const newPhones = parsed.phones.filter(p => !usedPhones.has(p));
    if (newPhones.length === 0) return;
    newPhones.forEach(p => usedPhones.add(p));

    blocks.push(parsed);
    const totalPhones = newPhones.length;
    newPhones.forEach((phone, phoneIndex) => {
      const displayName = totalPhones > 1
        ? `${parsed.clientName} /${phoneIndex + 1}`
        : parsed.clientName;
      contacts.push({
        name: displayName,
        phone,
        lawyer_name: parsed.lawyer,
        process_number: parsed.process,
        cpf: parsed.cpf,
        renda: parsed.renda ? parseFloat(parsed.renda.replace(/\./g, "").replace(",", ".")) || undefined : undefined,
      });
    });
  };

  if (rawBlocks.length === 0) {
    const parsedList = parseBlock(rawText);
    if (parsedList.length > 0) {
      parsedList.forEach(addContactsFromBlock);
    } else {
      errors.push("Nenhum bloco válido encontrado. Verifique o formato da lista.");
    }
    return { contacts, errors, blocks };
  }

  rawBlocks.forEach((rawBlock, index) => {
    const parsedList = parseBlock(rawBlock);

    if (parsedList.length === 0) {
      if (!isMessageLine(rawBlock.trim().split('\n')[0] || '')) {
        errors.push(`Bloco ${index + 1}: Formato inválido ou nenhum celular encontrado`);
      }
      return;
    }

    parsedList.forEach(addContactsFromBlock);
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
