import { useState, useEffect, useRef } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useMetaTemplates, MetaTemplate } from "@/hooks/useMetaTemplates";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PhoneNumberSelector } from "@/components/chat/PhoneNumberSelector";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Radio, Send, List, Layers, Pause, Play, XCircle, Timer, User, ChevronLeft, ChevronRight, Check, Phone, FileText } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// --- Types & helpers ---

const CONTACT_FIELD_OPTIONS = [
  { value: "name", label: "Nome do Cliente", defaultHint: "" },
  { value: "advogado", label: "Nome do Advogado (Nº Disparo)", defaultHint: "" },
  { value: "phone", label: "Telefone", defaultHint: "" },
  { value: "lawyer_name", label: "Parte Contrária", defaultHint: "Padrão: ********" },
  { value: "process_number", label: "Número do Processo", defaultHint: "Padrão: 0031486-26.2025.8.26.0002" },
  { value: "cpf", label: "CPF", defaultHint: "" },
  { value: "valor_da_causa", label: "Valor da Causa", defaultHint: "" },
];

function extractVariables(text: string): number[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => parseInt(m.replace(/[{}]/g, ""))))].sort((a, b) => a - b);
}

function getTemplateBody(template: MetaTemplate): string {
  if (template.components) {
    const body = (template.components as any[]).find((c: any) => c.type === "BODY");
    return body?.text || "";
  }
  return "";
}

interface ContactList {
  name: string;
  count: number;
}

type DispatchMode = "batch" | "individual";

interface ActiveDispatch {
  id: string;
  operatorName: string;
  operatorId: string;
  templateName: string;
  listName: string;
  mode: DispatchMode;
  total: number;
  sent: number;
  failed: number;
  current: number;
  isPaused: boolean;
  isCancelled: boolean;
  isFinished: boolean;
  errors: string[];
}

const STEPS = [
  { id: 1, label: "Número", icon: Phone },
  { id: 2, label: "Template", icon: FileText },
  { id: 3, label: "Lista", icon: List },
  { id: 4, label: "Enviar", icon: Send },
];

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? 300 : -300, opacity: 0 }),
};

export default function AdminDisparosPage() {
  const { users } = useAdmin();
  const { allTemplates } = useMetaTemplates();
  const { phones } = useWabaPhones();
  const { user } = useAuthContext();

  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);

  // Step 1: Phone
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  // Step 2: Template
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});
  // Step 3: List + dispatch mode
  const [selectedList, setSelectedList] = useState<string>("");
  const [availableLists, setAvailableLists] = useState<ContactList[]>([]);
  const [listContactCount, setListContactCount] = useState(0);
  const [loadingLists, setLoadingLists] = useState(false);
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>("batch");
  const [batchMode, setBatchMode] = useState(false);
  const [batchSize, setBatchSize] = useState(50);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  // Step 4: Responsible
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Multiple active dispatches
  const [activeDispatches, setActiveDispatches] = useState<ActiveDispatch[]>([]);
  const dispatchControlsRef = useRef<Record<string, { isPaused: boolean; isCancelled: boolean }>>({});

  // Phone data for advogado variable
  const selectedPhoneData = phones.find(p => p.phone_number_id === selectedPhoneNumberId);
  const phoneVerifiedName = selectedPhoneData?.verified_name || selectedPhoneData?.lawyer_name || "";

  const hasActiveDispatch = activeDispatches.some(d => !d.isFinished);

  // Auto-select phone
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedPhoneNumberId]);

  // Load available lists
  useEffect(() => {
    setLoadingLists(true);
    supabase
      .from("contacts")
      .select("*")
      .is("user_id", null)
      .then(({ data }) => {
        if (!data) { setLoadingLists(false); return; }
        const map: Record<string, number> = {};
        (data as any[]).forEach((c) => {
          const listName = c.contact_list;
          if (!listName) return;
          map[listName] = (map[listName] || 0) + 1;
        });
        setAvailableLists(Object.entries(map).map(([name, count]) => ({ name, count })));
        setLoadingLists(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedList) { setListContactCount(0); return; }
    const found = availableLists.find((l) => l.name === selectedList);
    setListContactCount(found?.count || 0);
  }, [selectedList, availableLists]);

  useEffect(() => {
    if (!selectedTemplate) { setVariableMappings({}); return; }
    const body = getTemplateBody(selectedTemplate);
    const vars = extractVariables(body);
    const defaults: Record<string, string> = {};
    vars.forEach((v, i) => {
      if (i === 0) defaults[String(v)] = "name";
      else if (i === 1) defaults[String(v)] = "process_number";
    });
    setVariableMappings(defaults);
  }, [selectedTemplate]);

  const approvedTemplates = allTemplates.filter((t) => t.status === "APPROVED");
  const templateBody = selectedTemplate ? getTemplateBody(selectedTemplate) : "";
  const templateVars = extractVariables(templateBody);
  const effectiveCount = batchMode ? Math.min(batchSize, listContactCount) : listContactCount;

  const isStep1Valid = phones.length === 0 || !!selectedPhoneNumberId;
  const isStep2Valid = !!selectedTemplate;
  const isStep3Valid = !!selectedList && listContactCount > 0;

  const canProceed = (step: number) => {
    switch (step) {
      case 1: return isStep1Valid;
      case 2: return isStep2Valid;
      case 3: return isStep3Valid;
      default: return true;
    }
  };

  const goToStep = (step: number) => {
    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
  };
  const handleNext = () => { if (currentStep < 4 && canProceed(currentStep)) goToStep(currentStep + 1); };
  const handleBack = () => { if (currentStep > 1) goToStep(currentStep - 1); };

  const refreshLists = () => {
    supabase.from("contacts").select("*").is("user_id", null).then(({ data }) => {
      if (!data) return;
      const map: Record<string, number> = {};
      (data as any[]).forEach((c) => {
        const listName = c.contact_list;
        if (!listName) return;
        map[listName] = (map[listName] || 0) + 1;
      });
      const lists = Object.entries(map).map(([name, count]) => ({ name, count }));
      setAvailableLists(lists);
    });
  };

  // --- Dispatch logic ---
  const updateDispatch = (dispatchId: string, updates: Partial<ActiveDispatch>) => {
    setActiveDispatches((prev) => prev.map((d) => (d.id === dispatchId ? { ...d, ...updates } : d)));
  };

  const handleSend = async () => {
    if (!selectedTemplate || !selectedList || !selectedUserId) return;
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }

    const { data, error } = await (supabase as any)
      .from("contacts")
      .select("id")
      .is("user_id", null)
      .eq("contact_list", selectedList);

    if (error || !data || data.length === 0) {
      toast.error("Nenhum contato encontrado na lista selecionada");
      return;
    }

    let contactIds = (data as any[]).map((c) => c.id);
    if (batchMode) contactIds = contactIds.slice(0, batchSize);

    const operatorProfile = users.find((u) => u.user_id === selectedUserId);
    const dispatchId = crypto.randomUUID();

    // Save refs for this dispatch's controls
    dispatchControlsRef.current[dispatchId] = { isPaused: false, isCancelled: false };

    const newDispatch: ActiveDispatch = {
      id: dispatchId,
      operatorName: operatorProfile?.full_name || "Operador",
      operatorId: selectedUserId,
      templateName: selectedTemplate.name,
      listName: selectedList,
      mode: dispatchMode,
      total: contactIds.length,
      sent: 0,
      failed: 0,
      current: 0,
      isPaused: false,
      isCancelled: false,
      isFinished: false,
      errors: [],
    };

    setActiveDispatches((prev) => [newDispatch, ...prev]);

    // Capture values for the async closure
    const capturedTemplate = selectedTemplate;
    const capturedUserId = selectedUserId;
    const capturedPhoneId = selectedPhoneNumberId;
    const capturedMappings = { ...variableMappings };
    const capturedPhoneVerifiedName = phoneVerifiedName;
    const capturedMode = dispatchMode;
    const capturedInterval = intervalSeconds;

    // Run dispatch in background
    (async () => {
      const results = { sent: 0, failed: 0, errors: [] as string[] };

      try {
        if (capturedMode === "individual") {
          for (let i = 0; i < contactIds.length; i++) {
            const ctrl = dispatchControlsRef.current[dispatchId];
            if (ctrl?.isCancelled) break;

            // Pause loop
            while (ctrl?.isPaused && !ctrl?.isCancelled) {
              await new Promise((r) => setTimeout(r, 500));
            }
            if (ctrl?.isCancelled) break;

            const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
              body: {
                contactIds: [contactIds[i]],
                templateName: capturedTemplate.name,
                templateLanguage: capturedTemplate.language,
                userId: capturedUserId,
                selectedPhoneNumberId: capturedPhoneId || undefined,
                variableMappings: capturedMappings,
                phoneVerifiedName: capturedPhoneVerifiedName,
              },
            });

            if (!sendError && result?.results) {
              results.sent += result.results.sent || 0;
              results.failed += result.results.failed || 0;
              if (result.results.errors) results.errors.push(...result.results.errors);
            } else {
              results.failed++;
              if (sendError) results.errors.push(sendError.message);
            }

            updateDispatch(dispatchId, {
              current: i + 1,
              sent: results.sent,
              failed: results.failed,
              errors: [...results.errors],
            });

            // Interval between sends
            if (i < contactIds.length - 1 && !ctrl?.isCancelled) {
              for (let s = 0; s < capturedInterval * 2; s++) {
                if (ctrl?.isCancelled) break;
                while (ctrl?.isPaused && !ctrl?.isCancelled) {
                  await new Promise((r) => setTimeout(r, 500));
                }
                if (ctrl?.isCancelled) break;
                await new Promise((r) => setTimeout(r, 500));
              }
            }
          }
        } else {
          // Batch mode
          const CHUNK = 50;
          for (let i = 0; i < contactIds.length; i += CHUNK) {
            const ctrl = dispatchControlsRef.current[dispatchId];
            if (ctrl?.isCancelled) break;

            while (ctrl?.isPaused && !ctrl?.isCancelled) {
              await new Promise((r) => setTimeout(r, 500));
            }
            if (ctrl?.isCancelled) break;

            const chunk = contactIds.slice(i, i + CHUNK);

            const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
              body: {
                contactIds: chunk,
                templateName: capturedTemplate.name,
                templateLanguage: capturedTemplate.language,
                userId: capturedUserId,
                selectedPhoneNumberId: capturedPhoneId || undefined,
                variableMappings: capturedMappings,
                phoneVerifiedName: capturedPhoneVerifiedName,
              },
            });

            if (!sendError && result?.results) {
              results.sent += result.results.sent || 0;
              results.failed += result.results.failed || 0;
              if (result.results.errors) results.errors.push(...result.results.errors);
            }

            updateDispatch(dispatchId, {
              current: Math.min(i + CHUNK, contactIds.length),
              sent: results.sent,
              failed: results.failed,
              errors: [...results.errors],
            });
          }
        }

        const ctrl = dispatchControlsRef.current[dispatchId];
        if (ctrl?.isCancelled) {
          toast.warning(`${operatorProfile?.full_name}: Cancelado — ${results.sent} enviados, ${results.failed} falhas`, { id: `dispatch-${dispatchId}` });
        } else {
          toast.success(`${operatorProfile?.full_name}: Concluído — ${results.sent} enviados, ${results.failed} falhas`, { id: `dispatch-${dispatchId}` });
        }
      } catch (err: any) {
        toast.error(`Erro no disparo (${operatorProfile?.full_name})`, { description: err.message });
      } finally {
        updateDispatch(dispatchId, { isFinished: true });
        delete dispatchControlsRef.current[dispatchId];
        refreshLists();
      }
    })();

    // Don't reset form — allow another dispatch immediately
    toast.info(`Disparo iniciado para ${operatorProfile?.full_name}`, { id: `dispatch-${dispatchId}` });
  };

  const handlePause = (dispatchId: string) => {
    const ctrl = dispatchControlsRef.current[dispatchId];
    if (!ctrl) return;
    ctrl.isPaused = !ctrl.isPaused;
    updateDispatch(dispatchId, { isPaused: ctrl.isPaused });
  };

  const handleCancel = (dispatchId: string) => {
    const ctrl = dispatchControlsRef.current[dispatchId];
    if (!ctrl) return;
    ctrl.isCancelled = true;
    ctrl.isPaused = false;
    updateDispatch(dispatchId, { isCancelled: true, isPaused: false });
  };

  const handleDismissDispatch = (dispatchId: string) => {
    setActiveDispatches((prev) => prev.filter((d) => d.id !== dispatchId));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          Disparos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure cada etapa e dispare mensagens personalizadas.
        </p>
      </div>

      {/* Active dispatches — per operator */}
      {activeDispatches.length > 0 && (
        <div className="space-y-3">
          {activeDispatches.map((dispatch) => {
            const progress = dispatch.total > 0 ? (dispatch.current / dispatch.total) * 100 : 0;
            return (
              <motion.div
                key={dispatch.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className={dispatch.isFinished ? "border-muted" : "border-primary/30 bg-primary/5"}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold truncate">{dispatch.operatorName}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {dispatch.templateName}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {dispatch.listName}
                        </Badge>
                      </div>
                      {!dispatch.isFinished ? (
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePause(dispatch.id)}
                            className="gap-1 h-7 text-xs"
                          >
                            {dispatch.isPaused ? (
                              <><Play className="h-3 w-3" /> Retomar</>
                            ) : (
                              <><Pause className="h-3 w-3" /> Pausar</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCancel(dispatch.id)}
                            className="gap-1 h-7 text-xs"
                          >
                            <XCircle className="h-3 w-3" /> Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismissDispatch(dispatch.id)}
                          className="h-7 text-xs text-muted-foreground"
                        >
                          Fechar
                        </Button>
                      )}
                    </div>

                    <Progress value={progress} className="h-2" />

                    <div className="flex flex-wrap gap-3 text-xs">
                      <span className="text-muted-foreground">
                        {dispatch.isPaused ? "⏸️ Pausado" : dispatch.isFinished ? (dispatch.isCancelled ? "🚫 Cancelado" : "✅ Concluído") : `📤 ${dispatch.mode === "individual" ? "Individual" : "Lote"}`}
                      </span>
                      <span className="text-muted-foreground">{dispatch.current}/{dispatch.total}</span>
                      {dispatch.sent > 0 && <span className="text-success">✓ {dispatch.sent}</span>}
                      {dispatch.failed > 0 && <span className="text-destructive">✗ {dispatch.failed}</span>}
                    </div>

                    {dispatch.errors.length > 0 && (
                      <div className="max-h-20 overflow-y-auto rounded border p-2 text-xs text-destructive space-y-0.5">
                        {dispatch.errors.slice(-3).map((err, i) => <p key={i}>{err}</p>)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center justify-between px-2">
        {STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          const isClickable = step.id === 1 || (step.id <= currentStep) || canProceed(step.id - 1);
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => isClickable && goToStep(step.id)}
                disabled={!isClickable}
                className="flex flex-col items-center gap-1.5 group relative"
              >
                <motion.div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : isCompleted
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/20 bg-muted text-muted-foreground/40"
                  }`}
                  animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                </motion.div>
                <span className={`text-[11px] font-medium ${
                  isActive ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground/50"
                }`}>{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className="flex-1 mx-2 mt-[-18px]">
                  <div className={`h-0.5 rounded-full transition-colors ${isCompleted ? "bg-primary" : "bg-muted-foreground/15"}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden min-h-[340px] max-w-xl mx-auto">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {currentStep === 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    Número de Disparo
                  </CardTitle>
                  <CardDescription>Selecione o número pelo qual as mensagens serão enviadas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {phones.length > 0 ? (
                    <div>
                      <PhoneNumberSelector phones={phones} selectedPhoneNumberId={selectedPhoneNumberId} onSelect={setSelectedPhoneNumberId} />
                      {phoneVerifiedName && (
                        <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-primary mt-3 flex items-center gap-2">
                          👨‍⚖️ Advogado: <span className="font-semibold">{phoneVerifiedName}</span>
                        </motion.p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                      <Phone className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum número cadastrado</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Cadastre números na aba Telefones</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Template
                  </CardTitle>
                  <CardDescription>Selecione o template aprovado pela Meta e mapeie as variáveis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedTemplate?.name || ""} onValueChange={(name) => setSelectedTemplate(approvedTemplates.find((t) => t.name === name) || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o template..." /></SelectTrigger>
                    <SelectContent>
                      {approvedTemplates.map((t) => (<SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>))}
                    </SelectContent>
                  </Select>

                  {selectedTemplate && templateBody && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      {templateBody}
                    </motion.div>
                  )}

                  {templateVars.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Variáveis personalizadas</p>
                      {templateVars.map((v) => {
                        const selectedField = CONTACT_FIELD_OPTIONS.find(opt => opt.value === variableMappings[String(v)]);
                        const isAdvogado = variableMappings[String(v)] === "advogado";
                        return (
                          <div key={v} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs shrink-0">{`{{${v}}}`}</Badge>
                              <Select value={variableMappings[String(v)] || ""} onValueChange={(val) => setVariableMappings((prev) => ({ ...prev, [String(v)]: val }))}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Campo..." /></SelectTrigger>
                                <SelectContent>
                                  {CONTACT_FIELD_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            </div>
                            {isAdvogado && phoneVerifiedName && <p className="text-[10px] text-primary ml-14">→ {phoneVerifiedName}</p>}
                            {selectedField?.defaultHint && !isAdvogado && <p className="text-[10px] text-muted-foreground ml-14">{selectedField.defaultHint}</p>}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <List className="h-4 w-4 text-primary" />
                    Lista e Modo de Disparo
                  </CardTitle>
                  <CardDescription>
                    {selectedList && listContactCount > 0 ? `${effectiveCount} contato(s) serão disparados` : "Selecione a lista e o modo de envio"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingLists ? (
                    <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
                  ) : availableLists.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <List className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma lista disponível</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {availableLists.map((list) => (
                        <button key={list.name} onClick={() => setSelectedList(list.name)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors text-left ${
                            selectedList === list.name ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-muted"
                          }`}>
                          <span className="font-medium">{list.name}</span>
                          <Badge variant={selectedList === list.name ? "default" : "secondary"} className="text-xs">{list.count} contatos</Badge>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg border border-border p-3 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">Modo de disparo</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDispatchMode("batch")}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${dispatchMode === "batch" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                        <Layers className="h-4 w-4 mx-auto mb-1" /> Lote
                      </button>
                      <button onClick={() => setDispatchMode("individual")}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${dispatchMode === "individual" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                        <Timer className="h-4 w-4 mx-auto mb-1" /> Individual
                      </button>
                    </div>

                    {dispatchMode === "individual" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex items-center gap-2">
                        <Label htmlFor="interval" className="text-xs text-muted-foreground whitespace-nowrap">Intervalo:</Label>
                        <Input id="interval" type="number" min={1} max={300} value={intervalSeconds}
                          onChange={(e) => setIntervalSeconds(Math.max(1, parseInt(e.target.value) || 1))} className="h-8 w-20 text-sm" />
                        <span className="text-xs text-muted-foreground">segundos</span>
                      </motion.div>
                    )}

                    {dispatchMode === "batch" && (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="batch-mode" className="text-xs font-medium cursor-pointer">Modo lote limitado</Label>
                            <p className="text-[10px] text-muted-foreground">Limita quantidade por disparo</p>
                          </div>
                          <Switch id="batch-mode" checked={batchMode} onCheckedChange={setBatchMode} />
                        </div>
                        {batchMode && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                            <Label htmlFor="batch-size" className="text-xs text-muted-foreground whitespace-nowrap">Quantidade:</Label>
                            <Input id="batch-size" type="number" min={1} max={listContactCount || 9999} value={batchSize}
                              onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 1))} className="h-8 w-24 text-sm" />
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 4 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Responsável e Envio
                  </CardTitle>
                  <CardDescription>Revise o resumo e dispare</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o operador..." /></SelectTrigger>
                    <SelectContent>
                      {users.filter((u) => u.user_id !== user?.id).map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-muted p-4 space-y-2">
                    <p className="text-xs font-semibold mb-2">Resumo do disparo</p>
                    {[
                      { label: "Número", value: selectedPhoneData?.display_phone_number || "—" },
                      { label: "Template", value: selectedTemplate?.name || "—" },
                      { label: "Lista", value: selectedList || "—" },
                      { label: "Contatos", value: batchMode ? `${Math.min(batchSize, listContactCount)} de ${listContactCount}` : String(listContactCount) },
                      { label: "Modo", value: dispatchMode === "individual" ? `Individual (${intervalSeconds}s)` : batchMode ? `Lote de ${batchSize}` : "Lote completo" },
                      { label: "Responsável", value: users.find(u => u.user_id === selectedUserId)?.full_name || "—" },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{row.label}:</span>
                        <span className="font-medium truncate max-w-[200px]">{row.value}</span>
                      </div>
                    ))}
                  </motion.div>

                  <Button className="w-full gap-2" size="lg" onClick={handleSend}
                    disabled={!selectedTemplate || !selectedList || !selectedUserId || listContactCount === 0 || (phones.length > 0 && !selectedPhoneNumberId)}>
                    <Send className="h-4 w-4" /> Disparar para {effectiveCount} contato{effectiveCount !== 1 ? "s" : ""}
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          <span className="text-xs text-muted-foreground">Etapa {currentStep} de {STEPS.length}</span>
          {currentStep < 4 ? (
            <Button onClick={handleNext} disabled={!canProceed(currentStep)} className="gap-1.5">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="w-[100px]" />
          )}
        </div>
      </div>
    </div>
  );
}
