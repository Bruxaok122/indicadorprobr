import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Phone, Radio, CheckCircle, X, ChevronRight, ChevronLeft, Plus, Clock, Pause, Play, XCircle, Coffee, FileText } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useMetaTemplates, MetaTemplate } from "@/hooks/useMetaTemplates";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { useDispatchCooldown, formatCooldown } from "@/hooks/useDispatchCooldown";
import { useDispatchContext } from "@/contexts/DispatchContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { CreateTemplateDialog } from "@/components/templates/CreateTemplateDialog";
import { cn } from "@/lib/utils";

function extractVariables(text: string): number[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => parseInt(m.replace(/[{}]/g, ""))))].sort((a, b) => a - b);
}

function getTemplateBody(template: MetaTemplate): string {
  if (template.components) {
    const body = (template.components as any[]).find((c: any) => c.type === "BODY");
    return body?.text || "";
  }
  return "";
}

const CONTACT_FIELD_OPTIONS = [
  { value: "name", label: "Nome do Cliente" },
  { value: "advogado", label: "Nome do Advogado (Nº Disparo)" },
  { value: "phone", label: "Telefone" },
  { value: "lawyer_name", label: "Parte Contrária" },
  { value: "process_number", label: "Número do Processo" },
  { value: "cpf", label: "CPF" },
  { value: "valor_da_causa", label: "Valor da Causa" },
  { value: "vencimento", label: "Vencimento" },
  { value: "final_cc", label: "Final CC" },
  { value: "valor_fatura", label: "Valor Fatura" },
  { value: "gasto_utilizado", label: "Gasto (Utilizado)" },
];

const WIZARD_STORAGE_KEY = "operator-dispatch-wizard-v2";

interface PersistedWizardState {
  selectedPhoneNumberId: string;
  customAdvogadoName: string;
  selectedTemplateName: string;
  variableMappings: Record<string, string>;
  wizardStep: number;
}

function loadPersistedState(): Partial<PersistedWizardState> {
  try {
    const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function savePersistedState(state: Partial<PersistedWizardState>) {
  try {
    localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export default function OperatorDisparosPage() {
  const { user, profile } = useAuthContext();
  const { allTemplates, createTemplate, isCreatingTemplate, refetch: refetchTemplates } = useMetaTemplates();
  const { phones } = useWabaPhones();
  const {
    activeDispatches,
    dismissDispatch,
    handlePause,
    handleCancel,
  } = useDispatchContext();

  const { isReady: cooldownReady, remainingMs: cooldownMs, markDispatched } = useDispatchCooldown(user?.id, !!(profile as any)?.bypass_dispatch_cooldown);

  const persisted = loadPersistedState();

  // Wizard state
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState(persisted.selectedPhoneNumberId || "");
  const [customAdvogadoName, setCustomAdvogadoName] = useState(persisted.customAdvogadoName || "");
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>(persisted.variableMappings || {});
  const [wizardStep, setWizardStep] = useState(persisted.wizardStep ?? 0);

  // Single contact form
  const [avulsoName, setAvulsoName] = useState("");
  const [avulsoPhone, setAvulsoPhone] = useState("");
  const [avulsoCpf, setAvulsoCpf] = useState("");
  const [avulsoContra, setAvulsoContra] = useState("");
  const [avulsoProcesso, setAvulsoProcesso] = useState("");
  const [avulsoSending, setAvulsoSending] = useState(false);

  const [showCreateTemplate, setShowCreateTemplate] = useState(false);

  // Hydrate template once templates load
  useEffect(() => {
    if (!selectedTemplate && persisted.selectedTemplateName && allTemplates.length > 0) {
      const t = allTemplates.find(t => t.name === persisted.selectedTemplateName);
      if (t) setSelectedTemplate(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTemplates]);

  // Persist wizard state on changes
  useEffect(() => {
    savePersistedState({
      selectedPhoneNumberId,
      customAdvogadoName,
      selectedTemplateName: selectedTemplate?.name || "",
      variableMappings,
      wizardStep,
    });
  }, [selectedPhoneNumberId, customAdvogadoName, selectedTemplate, variableMappings, wizardStep]);

  const selectedPhoneData = phones.find(p => p.phone_number_id === selectedPhoneNumberId);
  const rawDisplayName = selectedPhoneData?.verified_name || selectedPhoneData?.lawyer_name || "";
  const defaultPhoneName = rawDisplayName.includes("|") ? rawDisplayName.split("|")[0].trim() : rawDisplayName;
  const phoneVerifiedName = customAdvogadoName || defaultPhoneName;

  const approvedTemplates = allTemplates.filter(t => (t as any).status === "APPROVED");
  const templateBody = selectedTemplate ? getTemplateBody(selectedTemplate) : "";
  const templateVars = extractVariables(templateBody);

  // Auto-select phone if there's only one
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedPhoneNumberId]);

  // Variables start empty on template change (no pre-selection); keep persisted ones on first mount
  const firstTemplateRun = useRef(true);
  useEffect(() => {
    if (firstTemplateRun.current) { firstTemplateRun.current = false; return; }
    if (!selectedTemplate) return;
    setVariableMappings({});
  }, [selectedTemplate]);

  const avulsoPhoneDigits = avulsoPhone.replace(/\D/g, "");
  const isAvulsoValid = !!avulsoName.trim() && avulsoPhoneDigits.length >= 10;

  const isStep0Valid = phones.length === 0 || !!selectedPhoneNumberId;
  const isStep1Valid = !!selectedTemplate;
  const isStep2Valid = isAvulsoValid;

  const stepLabels = ["Número", "Template", "Contato", "Enviar"];

  // --- Avulso: create a single contact and dispatch immediately ---
  const handleAvulsoSend = async () => {
    if (!cooldownReady) {
      toast.error(`Aguarde ${formatCooldown(cooldownMs)} para o próximo disparo`);
      return;
    }
    if (!user?.id || !selectedTemplate) return;
    const digits = avulsoPhone.replace(/\D/g, "");
    let normalized = digits;
    if (normalized.length === 11) normalized = "55" + normalized;
    else if (!normalized.startsWith("55")) normalized = "55" + normalized;
    if (normalized.length < 12) {
      toast.error("Telefone inválido");
      return;
    }
    if (!avulsoName.trim()) {
      toast.error("Informe o nome do contato");
      return;
    }
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }

    setAvulsoSending(true);
    try {
      let contactId: string | null = null;
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, status")
        .eq("phone", normalized)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .neq("status", "encerrado")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("contacts").update({
          status: "novo",
          name: avulsoName.trim(),
          lawyer_name: avulsoContra.trim() || "********",
          process_number: avulsoProcesso.trim() || "Não informado",
          cpf: avulsoCpf.trim() || null,
        }).eq("id", existing.id);
        if (error) throw error;
        contactId = existing.id;
      } else {
        const { data: created, error } = await supabase.from("contacts").insert({
          name: avulsoName.trim(),
          phone: normalized,
          lawyer_name: avulsoContra.trim() || "********",
          process_number: avulsoProcesso.trim() || "Não informado",
          cpf: avulsoCpf.trim() || null,
          status: "novo",
          user_id: user.id,
        }).select("id").single();
        if (error) throw error;
        contactId = created.id;
      }

      const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
        body: {
          contactIds: [contactId],
          templateName: selectedTemplate.name,
          templateLanguage: selectedTemplate.language,
          userId: user.id,
          assignedUserId: user.id,
          selectedPhoneNumberId: selectedPhoneNumberId || undefined,
          variableMappings,
          phoneVerifiedName,
          dispatchMode: "private",
        },
      });

      if (sendError) throw new Error(await getAvulsoErrorMessage(sendError));
      if (result?.results?.failed > 0) {
        const errMsg = result.results.errors?.[0] || "Falha no envio";
        toast.error("Envio falhou", { description: errMsg });
      } else {
        toast.success("Mensagem enviada!");
        markDispatched();
        setAvulsoName("");
        setAvulsoPhone("");
        setAvulsoCpf("");
        setAvulsoContra("");
        setAvulsoProcesso("");
      }
    } catch (err: any) {
      toast.error("Erro no envio", { description: err?.message || String(err) });
    } finally {
      setAvulsoSending(false);
    }
  };

  async function getAvulsoErrorMessage(err: any): Promise<string> {
    const fallback = err?.message || "Falha ao enviar";
    const resp = err?.context;
    if (resp && typeof resp.clone === "function") {
      try {
        const txt = await resp.clone().text();
        if (txt) {
          try { const p = JSON.parse(txt); return p?.error || p?.message || fallback; }
          catch { return txt; }
        }
      } catch {}
    }
    return fallback;
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
        <PageHeader title="Disparo Avulso" description="Envie uma mensagem para um único contato via WhatsApp" />

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mx-auto max-w-3xl space-y-6">

            {/* Active Dispatches */}
            {activeDispatches.filter(d => d.operatorId === user?.id).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Radio className="h-4 w-4 text-primary" />
                    Disparos Ativos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeDispatches.filter(d => d.operatorId === user?.id).map(dispatch => {
                    const progress = dispatch.total > 0 ? (dispatch.current / dispatch.total) * 100 : 0;
                    return (
                      <motion.div key={dispatch.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className={`rounded-lg border p-3 space-y-2 ${dispatch.isFinished ? "border-muted" : "border-primary/30 bg-primary/5"}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="outline" className="text-[10px]">{dispatch.templateName}</Badge>
                              <Badge variant="secondary" className="text-[10px]">{dispatch.listName}</Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {dispatch.mode === "turbo" ? "⚡ Turbo" : dispatch.mode === "individual" ? "Individual" : dispatch.mode === "scheduled" ? "📅 Programado" : "Lote"}
                              </Badge>
                            </div>
                            {!dispatch.isFinished ? (
                              <div className="flex gap-1.5 shrink-0">
                                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handlePause(dispatch.id)}>
                                  {dispatch.isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                                </Button>
                                <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => handleCancel(dispatch.id)}>
                                  <XCircle className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => dismissDispatch(dispatch.id)}>
                                Limpar
                              </Button>
                            )}
                          </div>
                          <Progress value={progress} className="h-2" />
                          {dispatch.breathingUntil && !dispatch.isFinished && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-500">
                              <Coffee className="h-3 w-3 animate-pulse" />
                              <span>Pausa de respiração...</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{dispatch.sent} enviados · {dispatch.failed} falhas</span>
                            <span>{Math.round(progress)}% ({dispatch.current}/{dispatch.total})</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Dispatch wizard card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="h-5 w-5 text-accent" /> Configurar Disparo
                </CardTitle>

                <div className="flex items-center gap-1 pt-3">
                  {stepLabels.map((label, i) => (
                    <div key={i} className="flex items-center gap-1 flex-1">
                      <button
                        onClick={() => i < wizardStep && setWizardStep(i)}
                        className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 transition-colors ${
                          i === wizardStep ? "bg-primary text-primary-foreground"
                            : i < wizardStep ? "bg-primary/20 text-primary cursor-pointer"
                            : "bg-muted text-muted-foreground"
                        }`}>
                        {i + 1}
                      </button>
                      <span className={`text-[11px] truncate ${i === wizardStep ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {label}
                      </span>
                      {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </div>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="mx-auto max-w-xl">
                  <AnimatePresence mode="wait">
                    {/* Step 0: Phone */}
                    {wizardStep === 0 && (
                      <motion.div key="s0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Número de Disparo</Label>
                          {phones.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum número disponível.</p>
                          ) : (
                            <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                              <SelectTrigger><SelectValue placeholder="Selecione o número..." /></SelectTrigger>
                              <SelectContent>
                                {phones.map(p => (
                                  <SelectItem key={p.phone_number_id} value={p.phone_number_id}>
                                    <span className="flex items-center gap-2">
                                      <Phone className="h-3 w-3" />
                                      {p.display_phone_number} {p.verified_name ? `(${p.verified_name})` : ""}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {selectedPhoneData && (
                          <div className="space-y-2 rounded-lg border p-3">
                            <Label className="text-xs font-semibold">Nome do Advogado (variável)</Label>
                            <Input value={customAdvogadoName} onChange={e => setCustomAdvogadoName(e.target.value)}
                              placeholder={defaultPhoneName || "Nome do advogado..."} className="h-9" />
                            <p className="text-xs text-muted-foreground">
                              Derivado do nome de exibição: <span className="font-mono">{rawDisplayName}</span>
                            </p>
                          </div>
                        )}

                        <div className="flex justify-end pt-2">
                          <Button onClick={() => setWizardStep(1)} disabled={!isStep0Valid}>
                            Próximo <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 1: Template */}
                    {wizardStep === 1 && (
                      <motion.div key="s1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Template</Label>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowCreateTemplate(true)}>
                              <Plus className="mr-1 h-3 w-3" /> Criar Template
                            </Button>
                          </div>
                          <Select value={selectedTemplate?.name || ""}
                            onValueChange={v => setSelectedTemplate(approvedTemplates.find(t => t.name === v) || null)}>
                            <SelectTrigger><SelectValue placeholder="Selecione o template aprovado..." /></SelectTrigger>
                            <SelectContent>
                              {allTemplates.map(t => {
                                const isApproved = t.status === "APPROVED";
                                return (
                                  <SelectItem key={t.id} value={t.name} disabled={!isApproved}>
                                    <span className="flex items-center justify-between w-full gap-2">
                                      <span className="truncate">{t.name}</span>
                                      <span className={cn(
                                        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                                        t.status === "APPROVED" && "bg-success/10 text-success",
                                        t.status === "PENDING" && "bg-warning/10 text-warning",
                                        t.status === "REJECTED" && "bg-destructive/10 text-destructive",
                                      )}>
                                        {t.status === "APPROVED" && <><CheckCircle className="h-3 w-3" /> Aprovado</>}
                                        {t.status === "PENDING" && <><Clock className="h-3 w-3" /> Pendente</>}
                                        {t.status === "REJECTED" && <><X className="h-3 w-3" /> Rejeitado</>}
                                      </span>
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedTemplate && templateBody && (
                          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-semibold text-muted-foreground">Preview do Template</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{templateBody}</p>
                          </div>
                        )}

                        {templateVars.length > 0 && (
                          <div className="space-y-2 rounded-lg border p-3">
                            <Label className="text-xs font-semibold">Mapeamento de Variáveis</Label>
                            {templateVars.map(v => (
                              <div key={v} className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs shrink-0">{`{{${v}}}`}</Badge>
                                <Select value={variableMappings[String(v)] || ""}
                                  onValueChange={val => setVariableMappings(prev => ({ ...prev, [String(v)]: val }))}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Campo..." /></SelectTrigger>
                                  <SelectContent>
                                    {CONTACT_FIELD_OPTIONS.map(f => (
                                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-between pt-2">
                          <Button variant="outline" onClick={() => setWizardStep(0)}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                          </Button>
                          <Button onClick={() => setWizardStep(2)} disabled={!isStep1Valid}>
                            Próximo <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Contact */}
                    {wizardStep === 2 && (
                      <motion.div key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                        <div className="space-y-3">
                          <Label className="text-xs font-semibold">Dados do contato</Label>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Nome *</Label>
                            <Input value={avulsoName} onChange={(e) => setAvulsoName(e.target.value)} placeholder="Nome do cliente" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Telefone (com DDD) *</Label>
                            <Input value={avulsoPhone} onChange={(e) => setAvulsoPhone(e.target.value)} placeholder="Ex: 11970178814" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">CPF</Label>
                              <Input value={avulsoCpf} onChange={(e) => setAvulsoCpf(e.target.value)} placeholder="Opcional" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Parte Contrária</Label>
                              <Input value={avulsoContra} onChange={(e) => setAvulsoContra(e.target.value)} placeholder="Opcional" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Processo</Label>
                            <Input value={avulsoProcesso} onChange={(e) => setAvulsoProcesso(e.target.value)} placeholder="Opcional" />
                          </div>
                        </div>

                        <div className="flex justify-between pt-2">
                          <Button variant="outline" onClick={() => setWizardStep(1)}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                          </Button>
                          <Button onClick={() => setWizardStep(3)} disabled={!isStep2Valid}>
                            Próximo <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Send */}
                    {wizardStep === 3 && (
                      <motion.div key="s3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
                          <p><span className="font-semibold">Número:</span> {selectedPhoneData?.display_phone_number || "—"}</p>
                          <p><span className="font-semibold">Advogado:</span> {phoneVerifiedName || "—"}</p>
                          <p><span className="font-semibold">Template:</span> {selectedTemplate?.name || "—"}</p>
                          <p><span className="font-semibold">Contato:</span> {avulsoName} — {avulsoPhone}</p>
                          <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                            <Plus className="h-3.5 w-3.5" /> Disparo avulso
                          </p>
                        </div>

                        <Button className="w-full gap-2" size="lg" onClick={handleAvulsoSend}
                          disabled={!cooldownReady || avulsoSending || !isAvulsoValid || !selectedTemplate || (phones.length > 0 && !selectedPhoneNumberId)}>
                          {avulsoSending ? <LoadingSpinner size="sm" /> : <><Send className="h-4 w-4" /> {cooldownReady ? `Enviar para ${avulsoName || "contato"}` : `Aguarde ${formatCooldown(cooldownMs)}`}</>}
                        </Button>
                        {!cooldownReady && (
                          <p className="text-[11px] text-center text-muted-foreground tabular-nums">
                            ⏳ Próximo disparo disponível em <span className="font-mono font-semibold text-primary">{formatCooldown(cooldownMs)}</span>
                          </p>
                        )}

                        <div className="flex justify-start pt-2">
                          <Button variant="outline" onClick={() => setWizardStep(2)}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <CreateTemplateDialog
        open={showCreateTemplate}
        onOpenChange={setShowCreateTemplate}
        onSubmit={(data) => {
          createTemplate(data, {
            onSuccess: () => {
              setShowCreateTemplate(false);
              refetchTemplates();
            },
          });
        }}
        isSubmitting={isCreatingTemplate}
      />
    </AppLayout>
  );
}
