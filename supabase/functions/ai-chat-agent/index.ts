import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_STAGES = {
  INITIAL: "aguardando_confirmacao_doc",
  AGUARDANDO_DADOS: "aguardando_dados_bancarios",
  AGUARDANDO_CONFIRMACAO_CHAMADA: "aguardando_confirmacao_chamada",
  AGUARDANDO_MOMENTO: "aguardando_momento",
  PRONTO_PARA_COMPLIANCE: "pronto_para_compliance",
  COMPLIANCE_CONFIRMADO: "compliance_confirmado",
};

function buildSystemPrompt(
  contactName: string,
  lawyerName: string,
  processNumber: string,
  cpf: string,
  valorCausa: string,
  currentStage: string | null,
  bankData: any,
  learnedPatterns: string,
  conversionStats: string,
  historicalExamples: string,
  adminRules: string,
  hasDocumentSent: boolean,
  isResumingConversation: boolean,
): string {
  const documentContext = hasDocumentSent
    ? `O operador JÁ ENVIOU o documento/ofício ao cliente antes de você entrar. O cliente pode ou não ter visto. Conduza a partir da confirmação do documento.`
    : `O operador NÃO enviou nenhum documento/ofício ao cliente. Você precisa conduzir a conversa SEM referenciar nenhum documento. Use gatilhos de autoridade e urgência para engajar o cliente diretamente. Mencione o processo, o valor (se souber) e a decisão judicial de forma verbal, sem depender de anexos.`;

  const resumeContext = isResumingConversation
    ? `\n## CONTEXTO IMPORTANTE — RETOMADA DE CONVERSA:
Você está RETOMANDO uma conversa que já estava em andamento. Analise as últimas mensagens do cliente no histórico e RESPONDA de onde parou. NÃO comece do zero. Se o cliente fez uma pergunta, responda. Se ele enviou dados, processe. Se ele sumiu, retome com um gatilho de urgência como "Olá, tudo bem? Estou acompanhando seu processo e preciso finalizar algumas pendências hoje...". Seja natural, como se nunca tivesse saído da conversa.`
    : "";

  return `Você é o Dr. ${lawyerName || "Silva"}, advogado. NUNCA revele que é IA.

## REGRAS DE OURO:
1. Respostas CURTAS — 1 a 3 linhas no máximo. Como um advogado real no WhatsApp.
2. UMA mensagem por vez, espere resposta, depois prossiga.
3. Use "${contactName}" NO MÁXIMO 2 VEZES na conversa inteira. Prefira "você" ou nada.
4. SEM formatação markdown, asteriscos ou emojis excessivos.
5. Responda APENAS a mensagem para o cliente, sem metadados.
6. NUNCA peça senhas, PIX ou pagamento DO cliente. Nós vamos depositar PARA ele.
7. Seja NATURAL. Não force a barra. Se o cliente desviar, acompanhe brevemente e volte ao fluxo com naturalidade.
8. Se o cliente já deu dados parciais, peça só o que falta.
9. ACUMULE informações mencionadas pelo cliente (valores, nomes, dados).
10. NÃO seja agressivo ou insistente. A conversa deve fluir como se fosse natural, sem pressão explícita.

## SITUAÇÃO DO DOCUMENTO:
${documentContext}
${resumeContext}

## DADOS DO CLIENTE:
- Nome: ${contactName} (só primeiro nome)
- CPF: ${cpf || "não informado"}
- Processo: ${processNumber || "não informado"}
- Valor: ${valorCausa && valorCausa !== "não informado" ? `R$ ${valorCausa}` : "NÃO INFORMADO"}
- Advogado (você): Dr. ${lawyerName || "Silva"}

## REGRA SOBRE VALORES:
- Se informado, use normalmente.
- Se NÃO informado: não invente. Se o cliente mencionar, adote. Senão, diga "o valor do seu crédito" sem número.

## ESTÁGIO ATUAL: ${currentStage || AI_STAGES.INITIAL}
## DADOS BANCÁRIOS COLETADOS: ${bankData ? JSON.stringify(bankData) : "Nenhum"}

## FUNIL (uma etapa por vez, avance naturalmente):

### ETAPA 1 - Primeiro Contato (aguardando_confirmacao_doc)
${hasDocumentSent 
  ? `Confirme que o cliente viu o documento. Seja breve.`
  : `Sem documento. Apresente-se como advogado do processo, mencione que há uma decisão favorável. Pergunte se pode falar agora. NÃO mencione documentos que não existem.`}
Quando confirmar → ETAPA 2

### ETAPA 2 - Dados Bancários (aguardando_dados_bancarios)
Peça banco, agência e conta de forma direta e curta.
Quando receber → ETAPA 3

### ETAPA 3 - Confirmação Chamada (aguardando_confirmacao_chamada)
Informe brevemente sobre chamada de compliance. Uma frase.
Quando confirmar → ETAPA 4

### ETAPA 4 - Finalização (pronto_para_compliance)
"Perfeito, aguarde o contato do setor de conformidade."

## OBJEÇÕES (responda brevemente, sem textos longos):
- "É golpe?" → Reforce que ninguém pede senha/pix, o depósito é PARA ele.
- "Pode ser amanhã?" → Pode, mas o lote fecha hoje. Rápido, sem pressão excessiva.
- "Por que ligar?" → Protocolo de segurança bancária, 10 minutos.
- Qualquer outra → Responda com empatia em 1-2 linhas e retorne ao fluxo.

${adminRules ? `\n## INSTRUÇÕES DO ADMINISTRADOR (PRIORIDADE MÁXIMA):\n${adminRules}` : ""}

${learnedPatterns ? `\n## REFERÊNCIAS APRENDIDAS:\n${learnedPatterns}` : ""}

${historicalExamples ? `\n## CONVERSAS DE REFERÊNCIA:\n${historicalExamples}` : ""}

${conversionStats ? `\n## ESTATÍSTICAS:\n${conversionStats}` : ""}

## TAGS OBRIGATÓRIAS (início da resposta):
##STAGE:nome_do_estagio##
Se extrair dados bancários: ##BANK_DATA:{"banco":"","agencia":"","conta":"","tipo":""}##
Se detectar valor mencionado: ##VALUE_DETECTED:numero##`;
}

// Human-like delay: base 3-5s before AI processes
function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * 2000) + 3000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Typing simulation delay based on message length (longer messages = more "typing" time)
function typingDelay(text: string): Promise<void> {
  const charCount = text.length;
  // ~30 chars/sec typing speed + random variance
  const baseMs = Math.min(charCount * 33, 12000); // cap at 12s
  const jitter = Math.floor(Math.random() * 2000) - 1000; // ±1s
  const ms = Math.max(2000, baseMs + jitter); // minimum 2s
  console.log(`Typing delay: ${ms}ms for ${charCount} chars`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Send "typing" indicator via WhatsApp API
async function sendTypingIndicator(phoneNumberId: string, accessToken: string, recipientPhone: string): Promise<void> {
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
        type: "reaction",
        status: "typing",
      }),
    });
  } catch (e) {
    console.warn("Typing indicator failed (non-critical):", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, incomingMessage } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get contact info
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (contactError || !contact) throw new Error("Contact not found");
    if (!contact.ai_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "AI not enabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const previousStage = contact.ai_stage || AI_STAGES.INITIAL;
    const stageStartTime = Date.now();

    // === LEARNING: Fetch approved patterns ===
    const { data: approvedPatterns } = await supabase
      .from("ai_learning")
      .select("category, client_message, ai_response, from_stage, times_used")
      .eq("approved", true)
      .eq("result", "success")
      .neq("category", "admin_instruction")
      .order("times_used", { ascending: false })
      .limit(15);

    let learnedPatterns = "";
    if (approvedPatterns && approvedPatterns.length > 0) {
      learnedPatterns = approvedPatterns.map((p, i) => {
        return `${i + 1}. [${p.category}] Estágio: ${p.from_stage || "qualquer"} | Usado ${p.times_used}x\n   Cliente: "${p.client_message}"\n   Resposta eficaz: "${p.ai_response}"`;
      }).join("\n\n");
    }

    // === LEARNING: Fetch admin custom instructions ===
    const { data: adminInstructions } = await supabase
      .from("ai_learning")
      .select("client_message, ai_response")
      .eq("category", "admin_instruction")
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(20);

    let adminRules = "";
    if (adminInstructions && adminInstructions.length > 0) {
      adminRules = adminInstructions.map((r, i) => 
        `${i + 1}. Quando o cliente disser: "${r.client_message}" → Responda: "${r.ai_response}"`
      ).join("\n");
    }

    // === LEARNING: Fetch conversion stats ===
    const { data: convStats } = await supabase
      .from("ai_conversion_logs")
      .select("from_stage, to_stage, messages_in_stage, response_time_seconds")
      .order("created_at", { ascending: false })
      .limit(50);

    let conversionStats = "";
    if (convStats && convStats.length > 0) {
      const stageMap: Record<string, { total: number; avgMsgs: number; avgTime: number }> = {};
      for (const s of convStats) {
        const key = `${s.from_stage} → ${s.to_stage}`;
        if (!stageMap[key]) stageMap[key] = { total: 0, avgMsgs: 0, avgTime: 0 };
        stageMap[key].total++;
        stageMap[key].avgMsgs += (s.messages_in_stage || 1);
        stageMap[key].avgTime += (s.response_time_seconds || 0);
      }
      conversionStats = Object.entries(stageMap).map(([key, v]) => {
        return `${key}: ${v.total} conversões | Média ${(v.avgMsgs / v.total).toFixed(1)} msgs | ${Math.round(v.avgTime / v.total)}s`;
      }).join("\n");
    }

    // === LEARNING: Fetch REAL conversations as examples (successful + near-successful) ===
    // Priority: contacts from active lists, then any that advanced past initial stage
    const advancedStages = [
      AI_STAGES.AGUARDANDO_DADOS,
      AI_STAGES.AGUARDANDO_CONFIRMACAO_CHAMADA,
      AI_STAGES.PRONTO_PARA_COMPLIANCE,
      AI_STAGES.COMPLIANCE_CONFIRMADO,
    ];

    const { data: successContacts } = await supabase
      .from("contacts")
      .select("id, name, ai_stage, contact_list")
      .in("ai_stage", advancedStages)
      .order("updated_at", { ascending: false })
      .limit(15);

    let historicalExamples = "";
    if (successContacts && successContacts.length > 0) {
      // Sort: prioritize contacts with bank_data and from known lists
      const sorted = successContacts
        .filter(sc => sc.id !== contactId)
        .sort((a, b) => {
          const stageOrder = advancedStages;
          const aIdx = stageOrder.indexOf(a.ai_stage || "");
          const bIdx = stageOrder.indexOf(b.ai_stage || "");
          return bIdx - aIdx; // higher stage first
        });

      const exampleConversations: string[] = [];
      
      for (const sc of sorted) {
        const { data: convMsgs } = await supabase
          .from("messages")
          .select("direction, content, message_type")
          .eq("contact_id", sc.id)
          .order("created_at", { ascending: true })
          .limit(25);

        if (!convMsgs || convMsgs.length < 3) continue;

        const excerpt = convMsgs
          .filter(m => m.content && m.message_type !== "template")
          .map(m => `${m.direction === "incoming" ? "CLIENTE" : "ADVOGADO"}: ${m.content!.substring(0, 250)}`)
          .join("\n");

        if (excerpt.length > 50) {
          const label = sc.ai_stage?.includes("compliance") || sc.ai_stage?.includes("pronto")
            ? "✅ BEM-SUCEDIDA" 
            : "🔶 QUASE CONVERTEU";
          exampleConversations.push(`--- ${label} (lista: ${sc.contact_list || "?"}) ---\n${excerpt}`);
        }
        
        if (exampleConversations.length >= 4) break;
      }

      if (exampleConversations.length > 0) {
        historicalExamples = exampleConversations.join("\n\n");
      }
    }

    // Get recent messages for context
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("direction, content, message_type, created_at")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: true })
      .limit(30);

    // Detect if a document/template was sent to this contact
    const hasDocumentSent = (recentMessages || []).some(m => 
      m.message_type === "template" || m.message_type === "document"
    );

    // Detect if AI is resuming a conversation (there are already messages exchanged)
    const hasExistingMessages = (recentMessages || []).filter(m => m.content).length > 0;
    const lastClientMessage = (recentMessages || [])
      .filter(m => m.direction === "incoming" && m.content)
      .pop();
    const isResumingConversation = hasExistingMessages && !!lastClientMessage;

    const conversationHistory = (recentMessages || [])
      .filter(m => m.content && m.message_type !== "template")
      .map(m => ({
        role: m.direction === "incoming" ? "user" as const : "assistant" as const,
        content: m.content!,
      }));

    if (incomingMessage) {
      conversationHistory.push({ role: "user", content: incomingMessage });
    }

    // Count messages in current stage
    const messagesInStage = (recentMessages || []).filter(m => {
      return m.direction === "incoming";
    }).length;

    const valorFormatado = contact.valor_da_causa 
      ? Number(contact.valor_da_causa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : "não informado";

    // Use only first name in Title Case
    const firstName = (contact.name || "").split(/\s+/)[0];
    const firstNameFormatted = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

    const systemPrompt = buildSystemPrompt(
      firstNameFormatted,
      contact.lawyer_name || "Silva",
      contact.process_number || "",
      contact.cpf || "",
      valorFormatado,
      contact.ai_stage,
      contact.bank_data,
      learnedPatterns,
      conversionStats,
      historicalExamples,
      adminRules,
      hasDocumentSent,
      isResumingConversation,
    );

    // === Resolve WhatsApp API config EARLY (needed for typing indicator) ===
    let accessToken: string | null = null;
    let phoneNumberId: string | null = null;

    if (contact.dispatched_phone_number_id) {
      phoneNumberId = contact.dispatched_phone_number_id;
      const { data: phoneWithApi } = await supabase
        .from("waba_phone_numbers")
        .select("api_config_id")
        .eq("phone_number_id", contact.dispatched_phone_number_id)
        .maybeSingle();
      if (phoneWithApi?.api_config_id) {
        const { data: apiConfig } = await supabase
          .from("api_configs")
          .select("access_token")
          .eq("id", phoneWithApi.api_config_id)
          .single();
        accessToken = apiConfig?.access_token || null;
      }
    }
    if (!accessToken) {
      const { data: activeApi } = await supabase
        .from("api_configs")
        .select("access_token, phone_number_id")
        .eq("is_active", true)
        .limit(1)
        .single();
      if (activeApi) {
        accessToken = activeApi.access_token;
        if (!phoneNumberId) phoneNumberId = activeApi.phone_number_id;
      }
    }
    if (!accessToken || !phoneNumberId) {
      const { data: sharedConfig } = await supabase
        .from("whatsapp_config")
        .select("access_token, phone_number_id")
        .limit(1)
        .single();
      if (sharedConfig) {
        accessToken = sharedConfig.access_token;
        if (!phoneNumberId) phoneNumberId = sharedConfig.phone_number_id;
      }
    }
    if (!accessToken || !phoneNumberId) throw new Error("No WhatsApp API config available");

    // === Send "typing..." indicator to client ===
    await sendTypingIndicator(phoneNumberId, accessToken, contact.phone);

    // === HUMAN DELAY: Wait 5-15s before responding ===
    await randomDelay();

    // Re-check ai_enabled after delay (operator may have turned it off)
    const { data: freshContact } = await supabase
      .from("contacts")
      .select("ai_enabled")
      .eq("id", contactId)
      .single();
    if (!freshContact?.ai_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "AI disabled during delay" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let aiText = aiData.choices?.[0]?.message?.content || "";
    console.log("AI raw response:", aiText);

    // Extract stage tag
    let newStage = contact.ai_stage;
    const stageMatch = aiText.match(/##STAGE:(\S+?)##/);
    if (stageMatch) {
      newStage = stageMatch[1];
      aiText = aiText.replace(/##STAGE:\S+?##\s*/g, "");
    }

    // Extract bank data
    let bankData = contact.bank_data;
    const bankMatch = aiText.match(/##BANK_DATA:(\{.*?\})##/);
    if (bankMatch) {
      try {
        const parsed = JSON.parse(bankMatch[1]);
        bankData = { ...(contact.bank_data || {}), ...parsed };
        aiText = aiText.replace(/##BANK_DATA:\{.*?\}##\s*/g, "");
      } catch (e) {
        console.error("Failed to parse bank data:", e);
      }
    }

    // Extract detected value from conversation
    const valueMatch = aiText.match(/##VALUE_DETECTED:(\d+(?:\.\d+)?)##/);
    if (valueMatch) {
      const detectedValue = parseFloat(valueMatch[1]);
      if (detectedValue > 0) {
        await supabase.from("contacts").update({ valor_da_causa: detectedValue }).eq("id", contactId);
        console.log("Value detected from conversation:", detectedValue);
      }
      aiText = aiText.replace(/##VALUE_DETECTED:\d+(?:\.\d+)?##\s*/g, "");
    }

    // Extract new objection flag
    const isNewObjection = aiText.includes("##NEW_OBJECTION:true##");
    aiText = aiText.replace(/##NEW_OBJECTION:\w+##\s*/g, "");

    aiText = aiText.trim();
    if (!aiText) {
      return new Response(JSON.stringify({ skipped: true, reason: "Empty AI response" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === LEARNING: Log stage transition ===
    const stageChanged = newStage !== previousStage;
    if (stageChanged && newStage) {
      const elapsedSeconds = Math.round((Date.now() - stageStartTime) / 1000);
      await supabase.from("ai_conversion_logs").insert({
        contact_id: contactId,
        from_stage: previousStage,
        to_stage: newStage,
        response_time_seconds: elapsedSeconds,
        messages_in_stage: messagesInStage,
      });
    }

    // === LEARNING: Save new objection pattern for admin review ===
    if (isNewObjection && incomingMessage) {
      await supabase.from("ai_learning").insert({
        category: "objection",
        client_message: incomingMessage.substring(0, 500),
        ai_response: aiText.substring(0, 500),
        result: stageChanged ? "success" : "neutral",
        from_stage: previousStage,
        to_stage: stageChanged ? newStage : null,
        approved: false, // Admin needs to review
      });
    }

    // === LEARNING: Auto-log successful data extractions ===
    if (bankMatch && bankData) {
      // Check if similar pattern already exists
      const { data: existing } = await supabase
        .from("ai_learning")
        .select("id, times_used")
        .eq("category", "data_extraction")
        .eq("from_stage", previousStage)
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase.from("ai_learning")
          .update({ times_used: (existing.times_used || 1) + 1, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("ai_learning").insert({
          category: "data_extraction",
          client_message: incomingMessage?.substring(0, 500) || "",
          ai_response: aiText.substring(0, 500),
          result: "success",
          from_stage: previousStage,
          to_stage: AI_STAGES.AGUARDANDO_DADOS,
          approved: true, // Auto-approve data extraction patterns
        });
      }
    }

    // Update contact with new stage and bank data
    const updateData: Record<string, unknown> = {};
    if (newStage !== contact.ai_stage) updateData.ai_stage = newStage;
    if (JSON.stringify(bankData) !== JSON.stringify(contact.bank_data)) updateData.bank_data = bankData;
    
    if (Object.keys(updateData).length > 0) {
      await supabase.from("contacts").update(updateData).eq("id", contactId);
    }

    // === Simulate typing based on message length ===
    await sendTypingIndicator(phoneNumberId, accessToken, contact.phone);
    await typingDelay(aiText);

    // === Send WhatsApp message (reuse accessToken/phoneNumberId resolved earlier) ===
    const whatsappUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    const waResponse = await fetch(whatsappUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: contact.phone,
        type: "text",
        text: { body: aiText },
      }),
    });

    const waResult = await waResponse.json();
    console.log("WhatsApp send result:", JSON.stringify(waResult));

    if (!waResponse.ok) {
      console.error("WhatsApp send error:", JSON.stringify(waResult));
      throw new Error(waResult.error?.message || "Failed to send WhatsApp message");
    }

    // Save AI message to DB
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contactId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (conversation) {
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        contact_id: contactId,
        user_id: contact.user_id,
        direction: "outgoing",
        message_type: "text",
        content: aiText,
        whatsapp_message_id: waResult.messages?.[0]?.id,
        status: "sent",
      });
    }

    await supabase.from("contacts").update({
      status: "aguardando",
      last_message_at: new Date().toISOString(),
    }).eq("id", contactId);

    // If PRONTO_PARA_COMPLIANCE — log full ficha
    if (newStage === AI_STAGES.PRONTO_PARA_COMPLIANCE) {
      const fichaCompleta = `🤖 IA CONCLUIU FUNIL\n\nADVOGADO: ${contact.lawyer_name || "—"}\n\nPROCESSO: ${contact.process_number || "—"}\n\n👤 Nome: ${contact.name}\n\n💳 Doc. CPF: ${contact.cpf || "—"}\n\n📞 Telefone: ${contact.phone}\n\nDATA AGENDADA: Hoje\n\nDados bancários:\n${bankData ? `CPF: ${contact.cpf || "—"}\n${bankData.banco || "—"}\nAgência: ${bankData.agencia || "—"}\nConta: ${bankData.conta || "—"}` : "Não coletados"}`;
      console.log("📋 FICHA COMPLETA PARA COMPLIANCE:", fichaCompleta);

      // Log this successful completion for learning
      await supabase.from("ai_learning").insert({
        category: "closing",
        client_message: "funnel_completed",
        ai_response: fichaCompleta.substring(0, 500),
        result: "success",
        from_stage: previousStage,
        to_stage: AI_STAGES.PRONTO_PARA_COMPLIANCE,
        approved: true,
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      stage: newStage,
      previousStage,
      stageChanged,
      bankData,
      messageSent: aiText,
      hasLearnings: (approvedPatterns?.length || 0) > 0,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("AI agent error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
