import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useMetaTemplates, MetaTemplate } from "@/hooks/useMetaTemplates";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { useAuthContext } from "@/contexts/AuthContext";
import { useDispatchContext, ActiveDispatch, DispatchMode } from "@/contexts/DispatchContext";
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

/** Helper to re-fetch remaining contact IDs from a list (only pool contacts with user_id=null) */
async function fetchRemainingContactIds(listName: string, limit?: number): Promise<string[]> {
  const query = supabase
    .from("contacts")
    .select("id")
    .eq("contact_list", listName)
    .is("user_id", null);

  if (limit) query.limit(limit);

  const { data } = await query;
  return (data || []).map((c: any) => c.id);
}

// === Anti-ban protection constants ===
const ANTI_BAN_BLOCK_SIZE = 20; // Messages per breathing block
const ANTI_BAN_BREATHING_MS = 10 * 60 * 1000; // 10 minutes between blocks
const ANTI_BAN_MIN_DELAY_MS = 3000; // 3s min delay between individual sends
const ANTI_BAN_MAX_DELAY_MS = 8000; // 8s max delay between individual sends

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function antiBanDelay(min: number, max: number): Promise<void> {
  return new Promise(r => setTimeout(r, randomBetween(min, max)));
}

/** Get current hour in BRT (UTC-3) */
function getBrtHour(): number {
  const now = new Date();
  return (now.getUTCHours() - 3 + 24) % 24;
}

/** Check if current time is within allowed dispatch hours (10:00-17:00 BRT) */
function isWithinDispatchHours(): boolean {
  const hour = getBrtHour();
  return hour >= 10 && hour < 17;
}

/** Calculate ms until next dispatch window opens (10:00 BRT) */
function msUntilNextWindow(): number {
  const now = new Date();
  const brtHour = getBrtHour();
  const brtMinute = now.getUTCMinutes();
  
  if (brtHour >= 17) {
    // Wait until next day 10:00 BRT
    const hoursUntil = 24 - brtHour + 10;
    return (hoursUntil * 60 - brtMinute) * 60 * 1000;
  }
  if (brtHour < 10) {
    const hoursUntil = 10 - brtHour;
    return (hoursUntil * 60 - brtMinute) * 60 * 1000;
  }
  return 0;
}

/** Wait for breathing cooldown, checking for cancel every second */
async function breathingWait(
  dispatchId: string,
  durationMs: number,
  updateDispatch: (id: string, u: any) => void,
  controlsRef: React.MutableRefObject<Record<string, { isPaused: boolean; isCancelled: boolean }>>,
) {
  const until = new Date(Date.now() + durationMs).toISOString();
  updateDispatch(dispatchId, { breathingUntil: until });
  
  const endTime = Date.now() + durationMs;
  while (Date.now() < endTime) {
    const ctrl = controlsRef.current[dispatchId];
    if (ctrl?.isCancelled) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  updateDispatch(dispatchId, { breathingUntil: undefined });
}

/** Wait until dispatch hours if currently outside window */
async function waitForDispatchWindow(
  dispatchId: string,
  updateDispatch: (id: string, u: any) => void,
  controlsRef: React.MutableRefObject<Record<string, { isPaused: boolean; isCancelled: boolean }>>,
): Promise<boolean> {
  if (isWithinDispatchHours()) return true;
  
  const waitMs = msUntilNextWindow();
  if (waitMs <= 0) return true;
  
  const until = new Date(Date.now() + waitMs).toISOString();
  updateDispatch(dispatchId, { breathingUntil: until });
  
  // Wait in 30s increments, checking cancel and time
  while (!isWithinDispatchHours()) {
    const ctrl = controlsRef.current[dispatchId];
    if (ctrl?.isCancelled) {
      updateDispatch(dispatchId, { breathingUntil: undefined });
      return false;
    }
    await new Promise(r => setTimeout(r, 30000));
  }
  
  updateDispatch(dispatchId, { breathingUntil: undefined });
  return true;
}

export default function AdminDisparosPage() {
  const { users } = useAdmin();
  const { allTemplates } = useMetaTemplates();
  const { phones } = useWabaPhones();
  const { user } = useAuthContext();
  const {
    activeDispatches,
    addDispatch,
    updateDispatch,
    dismissDispatch,
    handlePause,
    handleCancel,
    dispatchControlsRef,
  } = useDispatchContext();

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

  // Phone data for advogado variable
  const selectedPhoneData = phones.find(p => p.phone_number_id === selectedPhoneNumberId);
  const phoneVerifiedName = selectedPhoneData?.verified_name || selectedPhoneData?.lawyer_name || "";

  // Auto-select phone
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedPhoneNumberId]);

  // Load available lists — always refresh on step 3, and once on mount
  useEffect(() => {
    refreshLists();

    if (currentStep === 3) {
      const interval = setInterval(refreshLists, 5000);
      return () => clearInterval(interval);
    }
  }, [currentStep]);

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

  function refreshLists() {
    if (!user?.id) {
      setAvailableLists([]);
      setLoadingLists(false);
      return;
    }

    setLoadingLists(true);
    supabase
      .from("contacts")
      .select("contact_list", { count: "exact", head: false })
      .is("user_id", null)
      .not("contact_list", "is", null)
      .limit(50000)
      .then(({ data }) => {
        if (!data) {
          setLoadingLists(false);
          return;
        }

        const map: Record<string, number> = {};
        (data as any[]).forEach((c) => {
          const listName = c.contact_list;
          if (!listName) return;
          map[listName] = (map[listName] || 0) + 1;
        });

        const lists = Object.entries(map)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setAvailableLists(lists);
        setLoadingLists(false);
      });
  }

  // --- Dispatch logic ---
  const getInvokeErrorMessage = async (sendError: any): Promise<string> => {
    const fallback = sendError?.message || "Falha ao chamar função de disparo";
    const statusCode = sendError?.context?.status;
    const statusLabel = statusCode ? ` (HTTP ${statusCode})` : "";

    const response = sendError?.context;
    if (response && typeof response.clone === "function") {
      try {
        const rawText = await response.clone().text();
        if (rawText) {
          try {
            const parsed = JSON.parse(rawText);
            const backendMessage =
              (typeof parsed?.error === "string" && parsed.error) ||
              (typeof parsed?.message === "string" && parsed.message) ||
              null;

            if (backendMessage) return `${backendMessage}${statusLabel}`;
          } catch {
            return `${rawText}${statusLabel}`;
          }
        }
      } catch {
        // ignora falha de leitura do body e usa fallback
      }
    }

    return `${fallback}${statusLabel}`;
  };

  const handleSend = async () => {
    if (!selectedTemplate || !selectedList || !selectedUserId) return;
    if (!user?.id) {
      toast.error("Sessão inválida, faça login novamente.", { duration: 8000 });
      return;
    }
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo", { duration: 8000 });
      return;
    }

    // Anti-ban: Check dispatch hours (10:00-17:00 BRT)
    if (!isWithinDispatchHours()) {
      const brtHour = getBrtHour();
      toast.error(
        `⏰ Fora do horário de disparo! Horário atual: ${brtHour}h (BRT). Disparos só são permitidos entre 10:00 e 17:00.`,
        { duration: 10000 }
      );
      return;
    }

    // Fetch remaining contacts from the list (real-time, only pool contacts)
    const contactIds = await fetchRemainingContactIds(
      selectedList,
      batchMode ? batchSize : undefined
    );

    if (contactIds.length === 0) {
      toast.error("Nenhum contato disponível na lista selecionada", { duration: 8000 });
      return;
    }

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

    addDispatch(newDispatch);

    // Capture values for the async closure
    const capturedTemplate = selectedTemplate;
    const capturedUserId = selectedUserId;
    const capturedPhoneId = selectedPhoneNumberId;
    const capturedMappings = { ...variableMappings };
    const capturedPhoneVerifiedName = phoneVerifiedName;
    const capturedMode = dispatchMode;
    const capturedInterval = intervalSeconds;
    const capturedListName = selectedList;
    const capturedBatchMode = batchMode;
    const capturedBatchSize = batchSize;

    // Run dispatch in background with anti-ban protections
    (async () => {
      const results = { sent: 0, failed: 0, errors: [] as string[] };
      let remainingIds = [...contactIds];
      let blockMessageCount = 0; // Counter for breathing blocks

      try {
        if (capturedMode === "individual") {
          let i = 0;
          while (i < remainingIds.length) {
            const ctrl = dispatchControlsRef.current[dispatchId];
            if (ctrl?.isCancelled) break;

            // Pause loop — on resume, re-fetch remaining contacts
            if (ctrl?.isPaused) {
              while (ctrl?.isPaused && !ctrl?.isCancelled) {
                await new Promise((r) => setTimeout(r, 500));
              }
              if (ctrl?.isCancelled) break;

              const freshIds = await fetchRemainingContactIds(
                capturedListName,
                capturedBatchMode ? Math.max(capturedBatchSize - results.sent, 1) : undefined
              );
              remainingIds = freshIds;
              i = 0;
              updateDispatch(dispatchId, { total: results.sent + results.failed + remainingIds.length });
              if (remainingIds.length === 0) break;
              continue;
            }

            // 🛡️ Anti-ban: Check time window before each send
            if (!isWithinDispatchHours()) {
              toast.info("⏰ Fora do horário (10-17h BRT). Aguardando próxima janela...", { id: `dispatch-window-${dispatchId}`, duration: 15000 });
              const canContinue = await waitForDispatchWindow(dispatchId, updateDispatch, dispatchControlsRef);
              if (!canContinue) break;
              toast.success("✅ Janela de disparo aberta! Retomando...", { id: `dispatch-window-${dispatchId}`, duration: 5000 });
            }

            // 🛡️ Anti-ban: Breathing pause after every BLOCK_SIZE messages
            if (blockMessageCount >= ANTI_BAN_BLOCK_SIZE && i < remainingIds.length) {
              const blocksCompleted = Math.floor((results.sent + results.failed) / ANTI_BAN_BLOCK_SIZE);
              updateDispatch(dispatchId, { blocksSent: blocksCompleted });
              toast.info(`☕ Bloco de ${ANTI_BAN_BLOCK_SIZE} enviado. Respirando por 10 minutos...`, { id: `dispatch-breathing-${dispatchId}`, duration: 10000 });
              await breathingWait(dispatchId, ANTI_BAN_BREATHING_MS, updateDispatch, dispatchControlsRef);
              const ctrl2 = dispatchControlsRef.current[dispatchId];
              if (ctrl2?.isCancelled) break;
              blockMessageCount = 0;

              // Re-check time window after breathing
              if (!isWithinDispatchHours()) {
                const canContinue = await waitForDispatchWindow(dispatchId, updateDispatch, dispatchControlsRef);
                if (!canContinue) break;
              }
            }

            const contactId = remainingIds[i];

            // Double-check this contact is still in the pool (user_id = null)
            const { data: checkContact } = await supabase
              .from("contacts")
              .select("id, user_id")
              .eq("id", contactId)
              .maybeSingle();

            if (!checkContact || checkContact.user_id !== null) {
              i++;
              updateDispatch(dispatchId, { current: results.sent + results.failed + 1 });
              continue;
            }

            const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
              body: {
                contactIds: [contactId],
                templateName: capturedTemplate.name,
                templateLanguage: capturedTemplate.language,
                userId: user?.id,
                assignedUserId: capturedUserId,
                selectedPhoneNumberId: capturedPhoneId || undefined,
                variableMappings: capturedMappings,
                phoneVerifiedName: capturedPhoneVerifiedName,
              },
            });

            if (!sendError && result?.results) {
              results.sent += result.results.sent || 0;
              results.failed += result.results.failed || 0;
              if (result.results.errors) results.errors.push(...result.results.errors);
              
              // 🛡️ Anti-ban: Circuit breaker - if business account blocked, stop everything
              if (result.results.errors?.some((e: string) => e.includes("Conta Business bloqueada"))) {
                toast.error("🛑 Conta Business bloqueada! Parando disparo imediatamente.", { duration: 30000 });
                break;
              }
            } else {
              results.failed++;
              if (sendError) results.errors.push(await getInvokeErrorMessage(sendError));
            }

            blockMessageCount++;

            updateDispatch(dispatchId, {
              current: results.sent + results.failed,
              sent: results.sent,
              failed: results.failed,
              errors: [...results.errors],
              blocksSent: Math.floor((results.sent + results.failed) / ANTI_BAN_BLOCK_SIZE),
            });

            i++;

            // 🛡️ Anti-ban: Randomized human-like delay (3-8 seconds) instead of fixed interval
            if (i < remainingIds.length && !ctrl?.isCancelled) {
              const delayMs = randomBetween(ANTI_BAN_MIN_DELAY_MS, ANTI_BAN_MAX_DELAY_MS);
              for (let s = 0; s < Math.ceil(delayMs / 500); s++) {
                const c = dispatchControlsRef.current[dispatchId];
                if (c?.isCancelled || c?.isPaused) break;
                await new Promise((r) => setTimeout(r, 500));
              }
            }
          }
        } else {
          // Batch mode — chunks of ANTI_BAN_BLOCK_SIZE (20) with breathing
          const CHUNK = ANTI_BAN_BLOCK_SIZE;
          let i = 0;
          let chunkIndex = 0;
          while (i < remainingIds.length) {
            const ctrl = dispatchControlsRef.current[dispatchId];
            if (ctrl?.isCancelled) break;

            if (ctrl?.isPaused) {
              while (ctrl?.isPaused && !ctrl?.isCancelled) {
                await new Promise((r) => setTimeout(r, 500));
              }
              if (ctrl?.isCancelled) break;

              const freshIds = await fetchRemainingContactIds(capturedListName);
              remainingIds = freshIds;
              i = 0;
              updateDispatch(dispatchId, { total: results.sent + results.failed + remainingIds.length });
              if (remainingIds.length === 0) break;
              continue;
            }

            // 🛡️ Anti-ban: Check time window
            if (!isWithinDispatchHours()) {
              toast.info("⏰ Fora do horário (10-17h BRT). Aguardando próxima janela...", { id: `dispatch-window-${dispatchId}`, duration: 15000 });
              const canContinue = await waitForDispatchWindow(dispatchId, updateDispatch, dispatchControlsRef);
              if (!canContinue) break;
              toast.success("✅ Janela de disparo aberta! Retomando...", { id: `dispatch-window-${dispatchId}`, duration: 5000 });
            }

            // 🛡️ Anti-ban: Breathing pause between chunks (skip first chunk)
            if (chunkIndex > 0) {
              updateDispatch(dispatchId, { blocksSent: chunkIndex });
              toast.info(`☕ Bloco ${chunkIndex} de ${CHUNK} enviado. Respirando por 10 minutos...`, { id: `dispatch-breathing-${dispatchId}`, duration: 10000 });
              await breathingWait(dispatchId, ANTI_BAN_BREATHING_MS, updateDispatch, dispatchControlsRef);
              const ctrl2 = dispatchControlsRef.current[dispatchId];
              if (ctrl2?.isCancelled) break;

              if (!isWithinDispatchHours()) {
                const canContinue = await waitForDispatchWindow(dispatchId, updateDispatch, dispatchControlsRef);
                if (!canContinue) break;
              }
            }

            const chunk = remainingIds.slice(i, i + CHUNK);

            const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
              body: {
                contactIds: chunk,
                templateName: capturedTemplate.name,
                templateLanguage: capturedTemplate.language,
                userId: user?.id,
                assignedUserId: capturedUserId,
                selectedPhoneNumberId: capturedPhoneId || undefined,
                variableMappings: capturedMappings,
                phoneVerifiedName: capturedPhoneVerifiedName,
              },
            });

            if (!sendError && result?.results) {
              results.sent += result.results.sent || 0;
              results.failed += result.results.failed || 0;
              if (result.results.errors) results.errors.push(...result.results.errors);

              // 🛡️ Anti-ban: Circuit breaker
              if (result.results.errors?.some((e: string) => e.includes("Conta Business bloqueada"))) {
                toast.error("🛑 Conta Business bloqueada! Parando disparo imediatamente.", { duration: 30000 });
                break;
              }
            } else {
              results.failed += chunk.length;
              results.errors.push(await getInvokeErrorMessage(sendError));

              const statusCode = (sendError as any)?.context?.status;
              if (statusCode === 401 || statusCode === 403) {
                updateDispatch(dispatchId, {
                  current: results.sent + results.failed,
                  sent: results.sent,
                  failed: results.failed,
                  errors: [...results.errors],
                });
                break;
              }
            }

            updateDispatch(dispatchId, {
              current: results.sent + results.failed,
              sent: results.sent,
              failed: results.failed,
              errors: [...results.errors],
              blocksSent: chunkIndex + 1,
            });

            i += CHUNK;
            chunkIndex++;
          }
        }

        const ctrl = dispatchControlsRef.current[dispatchId];
        if (ctrl?.isCancelled) {
          toast.warning(`${operatorProfile?.full_name}: Cancelado — ${results.sent} enviados, ${results.failed} falhas`, { id: `dispatch-${dispatchId}`, duration: 10000 });
        } else if (results.failed > 0) {
          toast.error(`${operatorProfile?.full_name}: Concluído com falhas — ${results.sent} enviados, ${results.failed} falhas`, { id: `dispatch-${dispatchId}`, duration: 15000 });
        } else {
          toast.success(`${operatorProfile?.full_name}: Concluído — ${results.sent} enviados`, { id: `dispatch-${dispatchId}`, duration: 8000 });
        }
      } catch (err: any) {
        toast.error(`Erro no disparo (${operatorProfile?.full_name})`, { description: err.message, duration: 15000 });
      } finally {
        updateDispatch(dispatchId, { isFinished: true, breathingUntil: undefined });
        delete dispatchControlsRef.current[dispatchId];
        refreshLists();
      }
    })();

    toast.info(`Disparo iniciado para ${operatorProfile?.full_name}`, { id: `dispatch-${dispatchId}`, duration: 5000 });
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
                          onClick={() => dismissDispatch(dispatch.id)}
                          className="h-7 text-xs text-muted-foreground"
                        >
                          Fechar
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">
                          {dispatch.isPaused ? "⏸️ Pausado" : dispatch.isFinished ? (dispatch.isCancelled ? "🚫 Cancelado" : "✅ Concluído") : "📤 Enviando..."}
                        </span>
                        <span className="font-semibold text-foreground">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2.5" />
                      <div className="flex flex-wrap gap-3 text-xs pt-0.5">
                        <span className="text-muted-foreground">{dispatch.current}/{dispatch.total} processados</span>
                        <span className="text-muted-foreground">({dispatch.mode === "individual" ? "Individual" : "Lote"})</span>
                        {dispatch.sent > 0 && <span className="text-success font-medium">✓ {dispatch.sent} enviados</span>}
                        {dispatch.failed > 0 && <span className="text-destructive font-medium">✗ {dispatch.failed} falhas</span>}
                      </div>
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
                      { label: "Modo", value: dispatchMode === "individual" ? "Individual (3-8s aleatório)" : "Lote (blocos de 20)" },
                      { label: "Responsável", value: users.find(u => u.user_id === selectedUserId)?.full_name || "—" },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{row.label}:</span>
                        <span className="font-medium truncate max-w-[200px]">{row.value}</span>
                      </div>
                    ))}
                  </motion.div>

                  {/* Anti-ban protection summary */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      🛡️ Proteções Anti-Ban Ativas
                    </p>
                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      <p>• Blocos de 20 mensagens com 10 min de respiro</p>
                      <p>• Delay aleatório entre envios (3-8s individual / 2-5s no lote)</p>
                      <p>• Horário restrito: 10:00 - 17:00 (BRT)</p>
                      <p>• Auto-bloqueio de respostas negativas</p>
                      <p>• Circuit breaker em caso de bloqueio da Meta</p>
                    </div>
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
