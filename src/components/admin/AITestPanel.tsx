import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, RotateCcw, User, Sparkles, Brain, MessageSquarePlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SimMessage {
  role: "user" | "assistant" | "system";
  content: string;
  stage?: string;
  bankData?: Record<string, string>;
  timestamp: Date;
  isInstruction?: boolean;
}

const AI_STAGES: Record<string, string> = {
  aguardando_confirmacao_doc: "📄 Confirmação Doc",
  aguardando_dados_bancarios: "🏦 Dados Bancários",
  aguardando_confirmacao_chamada: "📞 Confirmação Chamada",
  aguardando_momento: "⏳ Aguardando Momento",
  pronto_para_compliance: "✅ Pronto Compliance",
  compliance_confirmado: "🎉 Confirmado",
};

export function AITestPanel() {
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState("aguardando_confirmacao_doc");
  const [bankData, setBankData] = useState<Record<string, string> | null>(null);

  // Simulated contact config
  const [contactName, setContactName] = useState("João Carlos Silva");
  const [lawyerName, setLawyerName] = useState("Oliveira");
  const [processNumber, setProcessNumber] = useState("0001234-56.2024.8.26.0100");
  const [cpf, setCpf] = useState("123.456.789-00");
  const [valorCausa, setValorCausa] = useState("15000.00");
  const [configOpen, setConfigOpen] = useState(true);
  const [adminInstructions, setAdminInstructions] = useState<Array<{ id: string; client_message: string; ai_response: string }>>([]);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    loadAdminInstructions();
  }, []);

  async function loadAdminInstructions() {
    const { data } = await supabase
      .from("ai_learning")
      .select("id, client_message, ai_response")
      .eq("category", "admin_instruction")
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(20);
    setAdminInstructions(data || []);
  }

  async function saveInstructionFromChat(instruction: string) {
    try {
      await supabase.from("ai_learning").insert({
        category: "admin_instruction",
        client_message: "instrução geral",
        ai_response: instruction.trim(),
        result: "success",
        approved: true,
      });
      toast.success("✅ Instrução salva! A IA vai seguir essa regra em todas as conversas.");
      await loadAdminInstructions();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Desconhecido"));
    }
  }

  async function deleteAdminInstruction(id: string) {
    await supabase.from("ai_learning").delete().eq("id", id);
    toast.success("Instrução removida");
    await loadAdminInstructions();
  }

  const firstName = contactName.split(/\s+/)[0];
  const firstNameFormatted = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  function buildSystemPrompt(): string {
    const valorFormatado = valorCausa
      ? Number(valorCausa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : "não informado";

    const adminRulesText = adminInstructions.length > 0
      ? `\n## INSTRUÇÕES DO ADMINISTRADOR (PRIORIDADE MÁXIMA):\n${adminInstructions.map((r, i) => `${i + 1}. ${r.ai_response}`).join("\n")}`
      : "";

    return `Você é o Dr. ${lawyerName || "Silva"}, advogado. NUNCA revele que é IA.

## REGRAS DE OURO:
1. Respostas CURTAS — 1 a 3 linhas no máximo. Como um advogado real no WhatsApp.
2. UMA mensagem por vez, espere resposta, depois prossiga.
3. Use "${firstNameFormatted}" NO MÁXIMO 2 VEZES na conversa inteira.
4. SEM markdown, asteriscos ou emojis excessivos.
5. Responda APENAS a mensagem para o cliente.
6. NUNCA peça senhas, PIX ou pagamento DO cliente. Nós depositamos PARA ele.
7. Seja NATURAL. Não force a barra. Acompanhe o cliente e volte ao fluxo com naturalidade.
8. Se o cliente deu dados parciais, peça só o que falta.
9. NÃO seja agressivo ou insistente. A conversa deve fluir naturalmente.

## DADOS DO CLIENTE:
- Nome: ${firstNameFormatted}
- CPF: ${cpf || "não informado"}
- Processo: ${processNumber || "não informado"}
- Valor: ${valorFormatado && valorFormatado !== "não informado" ? `R$ ${valorFormatado}` : "NÃO INFORMADO"}
- Advogado (você): Dr. ${lawyerName || "Silva"}

## REGRA SOBRE VALORES:
- Se informado, use normalmente.
- Se NÃO informado: não invente. Se o cliente mencionar, adote. Senão, diga "o valor do seu crédito".

## ESTÁGIO ATUAL: ${currentStage}
## DADOS BANCÁRIOS COLETADOS: ${bankData ? JSON.stringify(bankData) : "Nenhum"}

## FUNIL (uma etapa por vez):
1. Confirmação (aguardando_confirmacao_doc) → Confirme, avance
2. Dados Bancários (aguardando_dados_bancarios) → Peça banco/agência/conta
3. Chamada (aguardando_confirmacao_chamada) → Informe sobre compliance
4. Finalização (pronto_para_compliance) → Confirmado

## OBJEÇÕES (1-2 linhas, sem textão):
- "É golpe?" → Ninguém pede senha/pix, o depósito é PARA ele.
- "Pode ser amanhã?" → Pode, mas o lote fecha hoje.
- Outras → Responda brevemente, retorne ao fluxo.
${adminRulesText}

## TAGS (início da resposta):
##STAGE:nome_do_estagio##
Se extrair dados bancários: ##BANK_DATA:{"banco":"","agencia":"","conta":"","tipo":""}##
Se detectar valor: ##VALUE_DETECTED:numero##`;
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");

    // Check for /instrução command - teach the AI directly from chat
    if (userMsg.startsWith("/instrução ") || userMsg.startsWith("/instrucao ") || userMsg.startsWith("/i ")) {
      const instruction = userMsg.replace(/^\/(instrução|instrucao|i)\s+/, "");
      if (instruction.length < 3) {
        toast.error("Instrução muito curta");
        return;
      }
      
      const instructionMsg: SimMessage = {
        role: "system",
        content: `📝 Instrução salva: "${instruction}"`,
        timestamp: new Date(),
        isInstruction: true,
      };
      setMessages((prev) => [...prev, instructionMsg]);
      await saveInstructionFromChat(instruction);
      return;
    }

    const newUserMessage: SimMessage = {
      role: "user",
      content: userMsg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const history = [
        ...messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: userMsg },
      ];

      const { data, error } = await supabase.functions.invoke("ai-test-chat", {
        body: {
          systemPrompt: buildSystemPrompt(),
          messages: history,
        },
      });

      if (error) throw error;

      let aiText = data.response || "";
      let detectedStage = currentStage;
      let detectedBank = bankData;

      // Extract stage
      const stageMatch = aiText.match(/##STAGE:(\S+?)##/);
      if (stageMatch) {
        detectedStage = stageMatch[1];
        setCurrentStage(detectedStage);
        aiText = aiText.replace(/##STAGE:\S+?##\s*/g, "");
      }

      // Extract bank data
      const bankMatch = aiText.match(/##BANK_DATA:(\{.*?\})##/);
      if (bankMatch) {
        try {
          const parsed = JSON.parse(bankMatch[1]);
          detectedBank = { ...(bankData || {}), ...parsed };
          setBankData(detectedBank);
          aiText = aiText.replace(/##BANK_DATA:\{.*?\}##\s*/g, "");
        } catch {}
      }

      // Extract detected value
      const valueMatch = aiText.match(/##VALUE_DETECTED:(\d+(?:\.\d+)?)##/);
      if (valueMatch) {
        const detected = parseFloat(valueMatch[1]);
        if (detected > 0) {
          setValorCausa(detected.toString());
          toast.info(`💰 Valor detectado: R$ ${detected.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
        }
        aiText = aiText.replace(/##VALUE_DETECTED:\d+(?:\.\d+)?##\s*/g, "");
      }

      aiText = aiText.trim();

      const aiMessage: SimMessage = {
        role: "assistant",
        content: aiText,
        stage: detectedStage,
        bankData: detectedBank || undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      console.error("AI test error:", err);
      toast.error("Erro ao chamar IA: " + (err.message || "Desconhecido"));
    } finally {
      setIsLoading(false);
    }
  }

  function resetConversation() {
    setMessages([]);
    setCurrentStage("aguardando_confirmacao_doc");
    setBankData(null);
    toast.success("Conversa reiniciada");
  }

  return (
    <div className="space-y-4">
      {/* Config Panel */}
      <Card className="border-accent/30">
        <CardHeader className="cursor-pointer pb-2" onClick={() => setConfigOpen(!configOpen)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                Configuração do Contato Simulado
              </CardTitle>
              <CardDescription>Defina os dados do cliente fictício para o teste</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {configOpen ? "▲ Fechar" : "▼ Abrir"}
            </Badge>
          </div>
        </CardHeader>
        {configOpen && (
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Nome do Cliente</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="João Carlos Silva" />
            </div>
            <div>
              <Label className="text-xs">Nome do Advogado (Dr.)</Label>
              <Input value={lawyerName} onChange={(e) => setLawyerName(e.target.value)} placeholder="Oliveira" />
            </div>
            <div>
              <Label className="text-xs">Nº do Processo</Label>
              <Input value={processNumber} onChange={(e) => setProcessNumber(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Valor da Causa (R$)</Label>
              <Input value={valorCausa} onChange={(e) => setValorCausa(e.target.value)} type="number" />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Admin Instructions Panel */}
      <Card className="border-primary/30">
        <CardHeader className="cursor-pointer pb-2" onClick={() => setInstructionsOpen(!instructionsOpen)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4 text-primary" />
                Instruções Ativas
              </CardTitle>
              <CardDescription>Instruções que a IA segue em todas as conversas</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{adminInstructions.length} regras</Badge>
              <Badge variant="outline" className="text-xs">
                {instructionsOpen ? "▲ Fechar" : "▼ Abrir"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        {instructionsOpen && (
          <CardContent className="space-y-2">
            {adminInstructions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma instrução. Use <code>/instrução</code> no chat para ensinar a IA.</p>
            ) : (
              adminInstructions.map((rule) => (
                <div key={rule.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                  <div className="flex-1">
                    <p>{rule.ai_response}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteAdminInstruction(rule.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          📍 Estágio: {AI_STAGES[currentStage] || currentStage}
        </Badge>
        {bankData && (
          <Badge variant="default" className="gap-1 bg-primary">
            🏦 {bankData.banco || "?"} | Ag: {bankData.agencia || "?"} | Cc: {bankData.conta || "?"}
          </Badge>
        )}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={resetConversation}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reiniciar
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <Card className="border-muted">
        <CardContent className="p-0">
          <ScrollArea className="h-[450px] p-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <Bot className="h-12 w-12 opacity-30" />
                <p className="text-sm">Envie uma mensagem para iniciar a simulação</p>
                <p className="text-xs opacity-60">Ex: "Oi, recebi uma mensagem sobre um processo"</p>
                <p className="text-xs opacity-40">Use <code>/instrução</code> para ensinar a IA diretamente</p>
              </div>
            )}
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex gap-2",
                  msg.isInstruction ? "justify-center" : msg.role === "assistant" ? "justify-start" : "justify-end"
                )}>
                  {msg.isInstruction ? (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 text-xs text-primary">
                      {msg.content}
                    </div>
                  ) : (
                    <>
                      {msg.role === "assistant" && (
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-accent" />
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col gap-1 max-w-[75%]">
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                            msg.role === "assistant"
                              ? "bg-muted text-foreground rounded-tl-sm"
                              : "bg-accent text-accent-foreground rounded-tr-sm"
                          )}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-[10px] opacity-50 mt-1 text-right">
                            {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      {msg.role === "user" && (
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-accent" />
                    </div>
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:0ms]" />
                      <div className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:150ms]" />
                      <div className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Cliente diz... ou /instrução para ensinar a IA"
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
        <Brain className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong>Ensine a IA no chat:</strong> Digite <code>/instrução</code> seguido do que quer que a IA aprenda.
          Ex: <code>/instrução Nunca mencione prazos de 15 dias</code> — A instrução será aplicada em todas as conversas reais.
        </p>
      </div>
    </div>
  );
}
