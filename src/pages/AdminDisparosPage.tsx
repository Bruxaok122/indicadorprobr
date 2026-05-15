import { useState, useEffect } from "react";
import { resilientDelay } from "@/lib/resilientDelay";
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
import { Radio, Send, List, Layers, Pause, Play, XCircle, Timer, User, ChevronLeft, ChevronRight, Check, Phone, FileText, CalendarClock, Zap } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
async function fetchRemainingContactIds(listName: string, limit?: number, minIncome?: number): Promise<string[]> {
  const query = supabase
    .from("contacts")
    .select("id")
    .eq("contact_list", listName)
    .is("user_id", null);

  if (typeof minIncome === "number") query.gte("valor_da_causa", minIncome);
  if (limit) query.limit(limit);

  const { data } = await query;
  return (data || []).map((c: any) => c.id);
}

// === Anti-ban protection constants ===
const ANTI_BAN_BLOCK_SIZE = 20; // Messages per breathing block
const ANTI_BAN_BREATHING_MS = 10 * 60 * 1000; // 10 minutes between blocks
const ANTI_BAN_MIN_DELAY_MS = 3000; // 3s min delay between individual sends
const ANTI_BAN_MAX_DELAY_MS = 8000; // 8s max delay between individual sends
const ANTI_BAN_DAILY_LIMIT = 500; // Max messages per day per dispatch session
const ANTI_BAN_PROGRESSIVE_FACTOR = 1.15; // Delay increases 15% per block
const ANTI_BAN_BLOCK_JITTER = 4; // Block size varies ±4 (16-24 instead of always 20)

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

/** Check if current time is within allowed dispatch hours (10:00-17:00 BRT) and not weekend */
/** ⚠️ TEMPORARILY BYPASSED FOR TESTING - revert after test! */
function isWithinDispatchHours(): boolean {
  return true; // TEMP: bypass for testing
  // const hour = getBrtHour();
  // const now = new Date();
  // const brtDay = new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCDay();
  // if (brtDay === 0 || brtDay === 6) return false;
  // return hour >= 10 && hour < 17;
}

/** Get jittered block size (16-24 instead of always 20) */
function getJitteredBlockSize(): number {
  return ANTI_BAN_BLOCK_SIZE + randomBetween(-ANTI_BAN_BLOCK_JITTER, ANTI_BAN_BLOCK_JITTER);
}

/** Get progressive delay multiplier based on blocks completed */
function getProgressiveDelay(blocksCompleted: number, baseMin: number, baseMax: number): [number, number] {
  const factor = Math.pow(ANTI_BAN_PROGRESSIVE_FACTOR, blocksCompleted);
  return [Math.round(baseMin * factor), Math.round(baseMax * factor)];
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
  const [randomJitter412, setRandomJitter412] = useState(false); // 4-12s random per send (anti-pattern)
  const [turboLimit, setTurboLimit] = useState(100);
  // Step 4: Responsible
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [sharedDispatch, setSharedDispatch] = useState(false);
  // Scheduling
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledHour, setScheduledHour] = useState("10");
  const [scheduledMinute, setScheduledMinute] = useState("00");
  // Filter: only dispatch to contacts with valor_da_causa >= 10000
  const [highIncomeOnly, setHighIncomeOnly] = useState(false);

  // Phone data for advogado variable (editable override)
  const selectedPhoneData = phones.find(p => p.phone_number_id === selectedPhoneNumberId);
  const defaultPhoneName = selectedPhoneData?.verified_name || selectedPhoneData?.lawyer_name || "";
  const [customAdvogadoName, setCustomAdvogadoName] = useState<string>("");
  const phoneVerifiedName = customAdvogadoName || defaultPhoneName;

  // Auto-select phone & reset custom name on phone change
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
    setCustomAdvogadoName(""); // Reset override when phone changes
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
  const effectiveCount = dispatchMode === "turbo" ? turboLimit : batchMode ? Math.min(batchSize, listContactCount) : listContactCount;

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

  async function refreshLists() {
    if (!user?.id) {
      setAvailableLists([]);
      setLoadingLists(false);
      return;
    }

    setLoadingLists(true);
    try {
      // Paginate to bypass Supabase's 1000-row default cap
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];
      while (from < 200000) {
        const { data, error } = await supabase
          .from("contacts")
          .select("contact_list")
          .is("user_id", null)
          .not("contact_list", "is", null)
          .range(from, from + pageSize - 1);
        if (error || !data) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      const map: Record<string, number> = {};
      all.forEach((c) => {
        const listName = c.contact_list;
        if (!listName) return;
        map[listName] = (map[listName] || 0) + 1;
      });

      const lists = Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setAvailableLists(lists);
    } finally {
      setLoadingLists(false);
    }
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
    if (!selectedTemplate || !selectedList) return;
    if (!sharedDispatch && !selectedUserId) return;
    if (!user?.id) {
      toast.error("Sessão inválida, faça login novamente.", { duration: 8000 });
      return;
    }
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo", { duration: 8000 });
      return;
    }

    // Handle scheduling
    if (isScheduled && scheduledDate) {
      const schedHour = parseInt(scheduledHour);
      const schedMin = parseInt(scheduledMinute);
      
      if (schedHour < 10 || schedHour >= 17) {
        toast.error("⏰ Horário agendado deve ser entre 10:00 e 17:00 (BRT)", { duration: 8000 });
        return;
      }

      // Calculate delay until scheduled time (BRT = UTC-3)
      const now = new Date();
      const brtOffset = -3 * 60 * 60 * 1000;
      const brtNowMs = now.getTime() + brtOffset;
      const scheduledBrt = new Date(scheduledDate);
      scheduledBrt.setHours(schedHour, schedMin, 0, 0);
      const delayMs = scheduledBrt.getTime() - brtNowMs;
      
      if (delayMs < 0) {
        toast.error("⏰ O horário agendado já passou!", { duration: 8000 });
        return;
      }
      
      const dayOfWeek = scheduledBrt.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        toast.error("🚫 Não é possível agendar para finais de semana!", { duration: 8000 });
        return;
      }
      
      toast.success(`📅 Disparo agendado para ${format(scheduledDate, "dd/MM/yyyy")} às ${scheduledHour}:${scheduledMinute} (BRT)`, { duration: 10000 });
      
      setTimeout(() => {
        if (!isWithinDispatchHours()) {
          toast.error("⏰ Fora do horário permitido no momento do agendamento.", { duration: 10000 });
          return;
        }
        executeDispatch();
      }, delayMs);
      return;
    }

    // Anti-ban: Check dispatch hours (10:00-17:00 BRT, no weekends) — skip for turbo mode
    if (dispatchMode !== "turbo" && !isWithinDispatchHours()) {
      const brtHour = getBrtHour();
      const now = new Date();
      const brtDay = new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCDay();
      const isWeekend = brtDay === 0 || brtDay === 6;
      toast.error(
        isWeekend
          ? `🚫 Disparos não são permitidos aos finais de semana! Agende para segunda-feira.`
          : `⏰ Fora do horário de disparo! ${brtHour}h (BRT). Só entre 10:00 e 17:00.`,
        { duration: 10000 }
      );
      return;
    }

    executeDispatch();
  };

  const executeDispatch = async () => {
    if (!selectedTemplate || !selectedList || !user?.id) return;
    if (!sharedDispatch && !selectedUserId) return;

    // Fetch remaining contacts from the list (real-time, only pool contacts)
    const isTurbo = dispatchMode === "turbo";
    const minIncomeFilter = highIncomeOnly ? 10000 : undefined;
    const contactIds = await fetchRemainingContactIds(
      selectedList,
      isTurbo ? turboLimit : batchMode ? batchSize : undefined,
      minIncomeFilter
    );

    if (contactIds.length === 0) {
      toast.error("Nenhum contato disponível na lista selecionada", { duration: 8000 });
      return;
    }

    // 🛡️ Anti-ban: Daily limit check (skip for turbo mode — user controls limit)
    if (!isTurbo && contactIds.length > ANTI_BAN_DAILY_LIMIT) {
      toast.warning(`⚠️ Limite diário: máximo ${ANTI_BAN_DAILY_LIMIT} mensagens por sessão. Limitando automaticamente.`, { duration: 10000 });
      contactIds.splice(ANTI_BAN_DAILY_LIMIT);
    }

    const operatorProfile = sharedDispatch ? null : users.find((u) => u.user_id === selectedUserId);
    const dispatchId = crypto.randomUUID();

    dispatchControlsRef.current[dispatchId] = { isPaused: false, isCancelled: false };

    const newDispatch: ActiveDispatch = {
      id: dispatchId,
      operatorName: sharedDispatch ? "Compartilhado 👥" : (operatorProfile?.full_name || "Operador"),
      operatorId: sharedDispatch ? (user.id as string) : selectedUserId,
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
    const capturedShared = sharedDispatch;
    const capturedInterval = intervalSeconds;
    const capturedRandomJitter = randomJitter412;
    const capturedListName = selectedList;
    const capturedBatchMode = batchMode;
    const capturedBatchSize = batchSize;
    const capturedTurboLimit = turboLimit;
    const capturedIsTurbo = isTurbo;

    // Run dispatch in background with anti-ban protections
    (async () => {
      const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] };
      let remainingIds = [...contactIds];
      let blockMessageCount = 0;
      let currentBlockSize = getJitteredBlockSize();
      let blocksCompleted = 0;
      let consecutiveErrors = 0; // Track consecutive errors for rate limit detection

      try {
        if (capturedIsTurbo) {
          // ⚡ TURBO MODE: No anti-ban, stop immediately on any error
          let i = 0;
          while (i < remainingIds.length) {
            const ctrl = dispatchControlsRef.current[dispatchId];
            if (ctrl?.isCancelled) break;

            if (ctrl?.isPaused) {
              while (ctrl?.isPaused && !ctrl?.isCancelled) {
                await new Promise((r) => setTimeout(r, 500));
              }
              if (ctrl?.isCancelled) break;
            }

            const contactId = remainingIds[i];

            // Check contact still available
            const { data: checkContact } = await supabase
              .from("contacts")
              .select("id, user_id")
              .eq("id", contactId)
              .maybeSingle();

            if (!checkContact || checkContact.user_id !== null) {
              results.skipped++;
              i++;
              updateDispatch(dispatchId, { current: results.sent + results.failed + results.skipped });
              continue;
            }

            const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
              body: {
                contactIds: [contactId],
                templateName: capturedTemplate.name,
                templateLanguage: capturedTemplate.language,
                userId: user?.id,
                assignedUserId: capturedShared ? undefined : capturedUserId,
                selectedPhoneNumberId: capturedPhoneId || undefined,
                variableMappings: capturedMappings,
                phoneVerifiedName: capturedPhoneVerifiedName,
                dispatchMode: capturedShared ? "shared" : "private",
              },
            });

            if (!sendError && result?.results) {
              if (result.results.failed > 0) {
                // ⚡ TURBO: Any API-level failure = stop immediately
                results.failed += result.results.failed;
                if (result.results.errors) results.errors.push(...result.results.errors);
                updateDispatch(dispatchId, {
                  current: results.sent + results.failed + results.skipped,
                  sent: results.sent,
                  failed: results.failed,
                  errors: [...results.errors],
                });
                toast.error(`🛑 Turbo: Erro detectado, parando imediatamente.`, { duration: 15000 });
                break;
              }
              results.sent += result.results.sent || 0;
            } else {
              // ⚡ TURBO: Edge function error = stop immediately
              results.failed++;
              if (sendError) results.errors.push(await getInvokeErrorMessage(sendError));
              updateDispatch(dispatchId, {
                current: results.sent + results.failed + results.skipped,
                sent: results.sent,
                failed: results.failed,
                errors: [...results.errors],
              });
              toast.error(`🛑 Turbo: Erro na API, parando imediatamente.`, { duration: 15000 });
              break;
            }

            updateDispatch(dispatchId, {
              current: results.sent + results.failed + results.skipped,
              sent: results.sent,
              failed: results.failed,
              errors: [...results.errors],
            });

            i++;

            // Delay: random 4-12s (anti-pattern) OR user interval + 5-25% jitter
            let turboDelayMs: number;
            if (capturedRandomJitter) {
              turboDelayMs = randomBetween(4000, 12000);
            } else {
              const baseDelayMs = Math.max(capturedInterval * 1000, 2000);
              const jitterMs = Math.floor(baseDelayMs * (0.05 + Math.random() * 0.20));
              turboDelayMs = baseDelayMs + jitterMs;
            }
            if (i < remainingIds.length && !ctrl?.isCancelled) {
              const waited = await resilientDelay(turboDelayMs, () => dispatchControlsRef.current[dispatchId]);
              if (!waited) break;
            }
          }
        } else if (capturedMode === "individual") {
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
              updateDispatch(dispatchId, { total: results.sent + results.failed + results.skipped + remainingIds.length });
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

            // 🛡️ Anti-ban: Breathing pause with jittered block size
            if (blockMessageCount >= currentBlockSize && i < remainingIds.length) {
              blocksCompleted++;
              updateDispatch(dispatchId, { blocksSent: blocksCompleted });
              
              // Progressive breathing: increase breathing time slightly each block
              const breathingMs = ANTI_BAN_BREATHING_MS + randomBetween(0, 2 * 60 * 1000); // 10-12 min
              toast.info(`☕ Bloco de ${currentBlockSize} enviado (${blocksCompleted}º). Respirando...`, { id: `dispatch-breathing-${dispatchId}`, duration: 10000 });
              await breathingWait(dispatchId, breathingMs, updateDispatch, dispatchControlsRef);
              const ctrl2 = dispatchControlsRef.current[dispatchId];
              if (ctrl2?.isCancelled) break;
              blockMessageCount = 0;
              currentBlockSize = getJitteredBlockSize(); // New jittered size for next block
              consecutiveErrors = 0; // Reset error counter after breathing

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
              results.skipped++;
              i++;
              updateDispatch(dispatchId, { current: results.sent + results.failed + results.skipped });
              continue;
            }

            const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
              body: {
                contactIds: [contactId],
                templateName: capturedTemplate.name,
                templateLanguage: capturedTemplate.language,
                userId: user?.id,
                assignedUserId: capturedShared ? undefined : capturedUserId,
                selectedPhoneNumberId: capturedPhoneId || undefined,
                variableMappings: capturedMappings,
                phoneVerifiedName: capturedPhoneVerifiedName,
                dispatchMode: capturedShared ? "shared" : "private",
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
              consecutiveErrors = 0;
            } else {
              results.failed++;
              consecutiveErrors++;
              if (sendError) results.errors.push(await getInvokeErrorMessage(sendError));
              
              // 🛡️ Anti-ban: Rate limit detection - if 3+ consecutive errors, emergency cooldown
              if (consecutiveErrors >= 3) {
                toast.warning("🚨 3 erros consecutivos! Cooldown de emergência (5 min)...", { duration: 15000 });
                await breathingWait(dispatchId, 5 * 60 * 1000, updateDispatch, dispatchControlsRef);
                consecutiveErrors = 0;
                const ctrl3 = dispatchControlsRef.current[dispatchId];
                if (ctrl3?.isCancelled) break;
              }
            }

            blockMessageCount++;

            updateDispatch(dispatchId, {
              current: results.sent + results.failed + results.skipped,
              sent: results.sent,
              failed: results.failed,
              errors: [...results.errors],
              blocksSent: Math.floor((results.sent + results.failed) / ANTI_BAN_BLOCK_SIZE),
            });

            i++;

            // 🛡️ Anti-ban: Random 4-12s OR MAX between user interval (with jitter) and progressive delay
            if (i < remainingIds.length && !ctrl?.isCancelled) {
              let delayMs: number;
              if (capturedRandomJitter) {
                delayMs = randomBetween(4000, 12000);
              } else {
                const baseUserDelayMs = capturedInterval * 1000;
                const userJitterMs = Math.floor(baseUserDelayMs * (0.05 + Math.random() * 0.20));
                const userDelayMs = baseUserDelayMs + userJitterMs;
                const [pMin, pMax] = getProgressiveDelay(blocksCompleted, ANTI_BAN_MIN_DELAY_MS, ANTI_BAN_MAX_DELAY_MS);
                const antiBanDelayMs = randomBetween(pMin, Math.min(pMax, 15000));
                delayMs = Math.max(userDelayMs, antiBanDelayMs);
              }
              const waited = await resilientDelay(delayMs, () => dispatchControlsRef.current[dispatchId]);
              if (!waited) break;
            }
          }
        } else {
          // Batch mode — chunks with jittered size and progressive breathing
          let batchBlockSize = getJitteredBlockSize();
          let i = 0;
          let chunkIndex = 0;
          let batchConsecutiveErrors = 0;
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
              updateDispatch(dispatchId, { total: results.sent + results.failed + results.skipped + remainingIds.length });
              if (remainingIds.length === 0) break;
              continue;
            }

            // 🛡️ Anti-ban: Check time window + weekends
            if (!isWithinDispatchHours()) {
              toast.info("⏰ Fora do horário (10-17h BRT, seg-sex). Aguardando...", { id: `dispatch-window-${dispatchId}`, duration: 15000 });
              const canContinue = await waitForDispatchWindow(dispatchId, updateDispatch, dispatchControlsRef);
              if (!canContinue) break;
              toast.success("✅ Janela de disparo aberta! Retomando...", { id: `dispatch-window-${dispatchId}`, duration: 5000 });
            }

            // 🛡️ Anti-ban: Breathing with progressive timing between chunks (skip first)
            if (chunkIndex > 0) {
              updateDispatch(dispatchId, { blocksSent: chunkIndex });
              const breathingMs = ANTI_BAN_BREATHING_MS + randomBetween(0, 2 * 60 * 1000);
              toast.info(`☕ Bloco ${chunkIndex} de ${batchBlockSize} enviado. Respirando...`, { id: `dispatch-breathing-${dispatchId}`, duration: 10000 });
              await breathingWait(dispatchId, breathingMs, updateDispatch, dispatchControlsRef);
              const ctrl2 = dispatchControlsRef.current[dispatchId];
              if (ctrl2?.isCancelled) break;
              batchBlockSize = getJitteredBlockSize();
              batchConsecutiveErrors = 0;

              if (!isWithinDispatchHours()) {
                const canContinue = await waitForDispatchWindow(dispatchId, updateDispatch, dispatchControlsRef);
                if (!canContinue) break;
              }
            }

            const chunk = remainingIds.slice(i, i + batchBlockSize);

            const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
              body: {
                contactIds: chunk,
                templateName: capturedTemplate.name,
                templateLanguage: capturedTemplate.language,
                userId: user?.id,
                assignedUserId: capturedShared ? undefined : capturedUserId,
                selectedPhoneNumberId: capturedPhoneId || undefined,
                variableMappings: capturedMappings,
                phoneVerifiedName: capturedPhoneVerifiedName,
                dispatchMode: capturedShared ? "shared" : "private",
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

            i += batchBlockSize;
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
                        <span className="text-muted-foreground">({dispatch.mode === "turbo" ? "⚡ Turbo" : dispatch.mode === "individual" ? "Individual" : "Lote"})</span>
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
                      {selectedPhoneNumberId && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-1.5">
                          <Label className="text-xs text-muted-foreground">👨‍⚖️ Nome do Advogado (usado na variável do template)</Label>
                          <Input
                            value={customAdvogadoName || defaultPhoneName}
                            onChange={(e) => setCustomAdvogadoName(e.target.value)}
                            placeholder={defaultPhoneName || "Nome do advogado"}
                            className="h-8 text-sm"
                          />
                          {customAdvogadoName && customAdvogadoName !== defaultPhoneName && (
                            <p className="text-[10px] text-primary">✏️ Nome editado (original: {defaultPhoneName})</p>
                          )}
                        </motion.div>
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
                      <button onClick={() => setDispatchMode("turbo")}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${dispatchMode === "turbo" ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "border-border hover:bg-muted"}`}>
                        <Zap className="h-4 w-4 mx-auto mb-1" /> Turbo
                      </button>
                    </div>

                    {dispatchMode === "individual" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
                        <div className={`flex items-center gap-2 transition-opacity ${randomJitter412 ? "opacity-40" : ""}`}>
                          <Label htmlFor="interval" className="text-xs text-muted-foreground whitespace-nowrap">Intervalo:</Label>
                          <Input id="interval" type="number" min={1} max={300} value={intervalSeconds}
                            disabled={randomJitter412}
                            onChange={(e) => setIntervalSeconds(Math.max(1, parseInt(e.target.value) || 1))} className="h-8 w-20 text-sm" />
                          <span className="text-xs text-muted-foreground">segundos</span>
                        </div>
                        <div className="flex items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                          <div className="min-w-0">
                            <Label htmlFor="random-jitter-ind" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                              🎲 Jitter aleatório 4–12s
                            </Label>
                            <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                              Sorteia um intervalo entre 4 e 12s a cada envio. Quebra o padrão de bot.
                            </p>
                          </div>
                          <Switch id="random-jitter-ind" checked={randomJitter412} onCheckedChange={setRandomJitter412} />
                        </div>
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

                    {dispatchMode === "turbo" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="turbo-limit" className="text-xs text-muted-foreground whitespace-nowrap">Limite de envios:</Label>
                          <Input id="turbo-limit" type="number" min={1} max={10000} value={turboLimit}
                            onChange={(e) => setTurboLimit(Math.max(1, parseInt(e.target.value) || 1))} className="h-8 w-24 text-sm" />
                        </div>
                        <div className="flex items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                          <div className="min-w-0">
                            <Label htmlFor="random-jitter-turbo" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                              🎲 Jitter aleatório 4–12s
                            </Label>
                            <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                              Sorteia um intervalo entre 4 e 12s a cada envio. Quebra o padrão de bot.
                            </p>
                          </div>
                          <Switch id="random-jitter-turbo" checked={randomJitter412} onCheckedChange={setRandomJitter412} />
                        </div>
                        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[10px] text-amber-600 dark:text-amber-400 space-y-0.5">
                          <p className="font-semibold">⚡ Modo Turbo — SEM proteções Anti-Ban</p>
                          <p>• Envia continuamente sem pausas de respiro</p>
                          <p>• Para IMEDIATAMENTE em qualquer erro da API</p>
                          <p>• Delay mínimo de 2s entre mensagens</p>
                          <p>• Use com responsabilidade</p>
                        </div>
                      </motion.div>
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
                  {/* 👥 Shared dispatch toggle */}
                  <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Label htmlFor="shared-toggle" className="text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                        Disparo Compartilhado 👥
                        {sharedDispatch && (
                          <span className="inline-flex items-center rounded-full bg-violet-500/20 px-1.5 py-0 text-[10px] font-bold text-violet-600 dark:text-violet-400">ATIVO</span>
                        )}
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Visível a todos os operadores. Quem responder primeiro assume o contato.
                      </p>
                    </div>
                    <Switch id="shared-toggle" checked={sharedDispatch} onCheckedChange={setSharedDispatch} />
                  </div>

                  <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={sharedDispatch}>
                    <SelectTrigger>
                      <SelectValue placeholder={sharedDispatch ? "Sem operador (compartilhado)" : "Selecione o operador..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.filter((u) => u.user_id !== user?.id).map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* 📅 Scheduling */}
                  <div className="rounded-lg border border-border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="schedule-toggle" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5 text-primary" />
                          Agendar disparo
                        </Label>
                        <p className="text-[10px] text-muted-foreground">Programe para enviar em outro horário</p>
                      </div>
                      <Switch id="schedule-toggle" checked={isScheduled} onCheckedChange={setIsScheduled} />
                    </div>

                    {isScheduled && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Data (BRT)</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left text-sm font-normal">
                                <CalendarClock className="mr-2 h-4 w-4" />
                                {scheduledDate ? format(scheduledDate, "dd/MM/yyyy") : "Selecione a data..."}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={scheduledDate}
                                onSelect={setScheduledDate}
                                disabled={(date) => {
                                  const day = date.getDay();
                                  return date < new Date(new Date().setHours(0,0,0,0)) || day === 0 || day === 6;
                                }}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Horário:</Label>
                          <Select value={scheduledHour} onValueChange={setScheduledHour}>
                            <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 7 }, (_, i) => i + 10).map((h) => (
                                <SelectItem key={h} value={String(h)} className="text-xs">{String(h).padStart(2, "0")}h</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">:</span>
                          <Select value={scheduledMinute} onValueChange={setScheduledMinute}>
                            <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["00", "15", "30", "45"].map((m) => (
                                <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">(BRT)</span>
                        </div>
                        <p className="text-[10px] text-amber-500">⚠️ Apenas seg-sex, entre 10:00 e 17:00 (BRT)</p>
                      </motion.div>
                    )}
                  </div>

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-muted p-4 space-y-2">
                    <p className="text-xs font-semibold mb-2">Resumo do disparo</p>
                    {[
                      { label: "Número", value: selectedPhoneData?.display_phone_number || "—" },
                      { label: "Template", value: selectedTemplate?.name || "—" },
                      { label: "Lista", value: selectedList || "—" },
                      { label: "Contatos", value: batchMode ? `${Math.min(batchSize, listContactCount)} de ${listContactCount}` : String(listContactCount) },
                      { label: "Modo", value: dispatchMode === "turbo" ? `Turbo (limite: ${turboLimit})` : dispatchMode === "individual" ? "Individual (progressivo)" : "Lote (blocos variáveis ~20)" },
                      { label: "Responsável", value: sharedDispatch ? "Compartilhado 👥" : (users.find(u => u.user_id === selectedUserId)?.full_name || "—") },
                      ...(isScheduled && scheduledDate ? [{ label: "📅 Agendado", value: `${format(scheduledDate, "dd/MM/yyyy")} às ${scheduledHour}:${scheduledMinute} BRT` }] : []),
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{row.label}:</span>
                        <span className="font-medium truncate max-w-[200px]">{row.value}</span>
                      </div>
                    ))}
                  </motion.div>

                  {/* Anti-ban protection summary */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
                    <p className="text-xs font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      🛡️ Proteções Anti-Ban v2
                    </p>
                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      <p>• Blocos variáveis (16-24 msgs) com respiro 10-12 min</p>
                      <p>• Delay progressivo (aumenta 15% por bloco, máx 15s)</p>
                      <p>• Horário restrito: seg-sex 10:00-17:00 (BRT)</p>
                      <p>• Limite diário: {ANTI_BAN_DAILY_LIMIT} mensagens por sessão</p>
                      <p>• Cooldown de emergência (3 erros consecutivos = 5 min)</p>
                      <p>• Auto-bloqueio de respostas negativas</p>
                      <p>• Circuit breaker em caso de bloqueio da Meta</p>
                    </div>
                  </motion.div>

                  <Button className="w-full gap-2" size="lg" onClick={handleSend}
                    disabled={!selectedTemplate || !selectedList || (!sharedDispatch && !selectedUserId) || listContactCount === 0 || (phones.length > 0 && !selectedPhoneNumberId) || (isScheduled && !scheduledDate)}>
                    {isScheduled ? <CalendarClock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {isScheduled ? `Agendar para ${effectiveCount} contato${effectiveCount !== 1 ? "s" : ""}` : `Disparar para ${effectiveCount} contato${effectiveCount !== 1 ? "s" : ""}`}
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
