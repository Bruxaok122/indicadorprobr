import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Upload, Send, Trash2, Pause, Play, XCircle, FileText, Phone, Radio, CheckCircle, X, ChevronRight, ChevronLeft, Plus, Clock, Eye, Users, ShieldCheck, RefreshCw, Layers, Timer, Zap, Coffee } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useContacts } from "@/hooks/useContacts";
import { useMetaTemplates, MetaTemplate } from "@/hooks/useMetaTemplates";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { useDispatchCooldown, formatCooldown } from "@/hooks/useDispatchCooldown";
import { useDispatchContext, ActiveDispatch, DispatchMode } from "@/contexts/DispatchContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { CreateTemplateDialog } from "@/components/templates/CreateTemplateDialog";
import { cn } from "@/lib/utils";
import { runDispatch, ANTI_BAN_DAILY_LIMIT } from "@/lib/dispatchEngine";

// --- Parser for the operator's raw format ---
interface OperatorParsedContact {
  name: string;
  phone: string;
  cpf?: string;
  contra?: string;
  process?: string;
  renda?: string;
}

function parseOperatorRawText(rawText: string): { contacts: OperatorParsedContact[]; errors: string[] } {
  const contacts: OperatorParsedContact[] = [];
  const errors: string[] = [];
  const blocks = rawText.split(/\n\s*\n/).filter(b => b.trim().length > 0);

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    const lines = block.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    let name = "";
    let cpf: string | undefined;
    let phones: string[] = [];
    let contra: string | undefined;
    let process: string | undefined;
    let renda: string | undefined;

    for (const line of lines) {
      if (/^NOME:/i.test(line)) {
        let afterColon = line.replace(/^NOME:\s*/i, "").trim();
        const rendaMatch = afterColon.match(/\s*-\s*renda\s+\$?([\d.,]+)/i);
        if (rendaMatch) {
          renda = rendaMatch[1];
          afterColon = afterColon.replace(/\s*-\s*renda\s+\$?[\d.,]+/i, "").trim();
        }
        if (afterColon) name = afterColon;
      } else if (/^CPF:/i.test(line)) {
        cpf = line.replace(/^CPF:\s*/i, "").trim() || undefined;
      } else if (/^TELEFONE:/i.test(line)) {
        const raw = line.replace(/^TELEFONE:\s*/i, "").trim();
        const parts = raw.split(",").map(p => p.trim()).filter(Boolean);
        for (const part of parts) {
          let digits = part.replace(/\D/g, "");
          if (digits.length === 11) digits = "55" + digits;
          else if (digits.length === 13 && digits.startsWith("55")) { /* ok */ }
          else if (!digits.startsWith("55")) digits = "55" + digits;
          if (digits.length >= 12) phones.push(digits);
        }
      } else if (/^CONTRA:/i.test(line)) {
        contra = line.replace(/^CONTRA:\s*/i, "").trim() || undefined;
      } else if (/^PROCESSO:/i.test(line)) {
        process = line.replace(/^PROCESSO:\s*/i, "").trim() || undefined;
      }
    }

    if (!name || phones.length === 0) {
      if (name) errors.push(`Bloco "${name}": sem telefone`);
      continue;
    }

    phones.forEach((phone, i) => {
      contacts.push({
        name: phones.length > 1 ? `${name} /${i + 1}` : name,
        phone, cpf, contra, process, renda,
      });
    });
  }
  return { contacts, errors };
}

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
];

// --- Wizard state persistence ---
const WIZARD_STORAGE_KEY = "operator-dispatch-wizard-v1";

type DispatchType = "lista" | "avulso";

interface PersistedWizardState {
  selectedPhoneNumberId: string;
  customAdvogadoName: string;
  selectedTemplateName: string;
  variableMappings: Record<string, string>;
  selectedList: string;
  minRenda: string;
  onlyVerifiedNames: boolean;
  sharedDispatch: boolean;
  dispatchMode: DispatchMode;
  dispatchType: DispatchType;
  intervalSeconds: number;
  randomJitter412: boolean;
  batchMode: boolean;
  batchSize: number;
  turboLimit: number;
  highIncomeOnly: boolean;
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
  const { importContacts: _import } = useContacts();
  const { allTemplates, createTemplate, isCreatingTemplate, refetch: refetchTemplates } = useMetaTemplates();
  const { phones } = useWabaPhones();
  const {
    activeDispatches,
    addDispatch,
    updateDispatch,
    dismissDispatch,
    handlePause,
    handleCancel,
    dispatchControlsRef,
  } = useDispatchContext();

  const { isReady: cooldownReady, remainingMs: cooldownMs, markDispatched } = useDispatchCooldown(user?.id);

  const persisted = loadPersistedState();

  // Import state (NOT persisted)
  const [rawText, setRawText] = useState("");
  const [parsedContacts, setParsedContacts] = useState<OperatorParsedContact[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [listName, setListName] = useState("");
  const [isValidatingWa, setIsValidatingWa] = useState(false);
  const [waValidationProgress, setWaValidationProgress] = useState({ done: 0, total: 0, removed: 0 });

  // Wizard state (PERSISTED)
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState(persisted.selectedPhoneNumberId || "");
  const [customAdvogadoName, setCustomAdvogadoName] = useState(persisted.customAdvogadoName || "");
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>(persisted.variableMappings || {});
  const [selectedList, setSelectedList] = useState(persisted.selectedList || "");
  const [dispatchType, setDispatchType] = useState<DispatchType>(persisted.dispatchType || "lista");
  // Operator-side hardcoded values: no income / verified / shared / mode options
  const minRenda = "all";
  const onlyVerifiedNames = false;
  const sharedDispatch = false;
  const dispatchMode = "batch" as DispatchMode;
  const intervalSeconds = persisted.intervalSeconds ?? 65;
  const randomJitter412 = false;
  const [batchMode, setBatchMode] = useState(persisted.batchMode ?? false);
  const [batchSize, setBatchSize] = useState(persisted.batchSize ?? 50);
  const turboLimit = persisted.turboLimit ?? 100;
  const highIncomeOnly = false;
  // 📅 Scheduled (programado) mode — sends N contacts every X minutes until 18h BRT.
  const [scheduledMode, setScheduledMode] = useState<boolean>((persisted as any).scheduledMode ?? false);
  const [scheduledChunkSize, setScheduledChunkSize] = useState<number>((persisted as any).scheduledChunkSize ?? 3);
  const [scheduledIntervalMinutes, setScheduledIntervalMinutes] = useState<number>((persisted as any).scheduledIntervalMinutes ?? 25);
  const [wizardStep, setWizardStep] = useState(persisted.wizardStep ?? 0);

  // Admin-defined max batch size (null = unlimited)
  const adminMaxBatchSize = (profile as any)?.max_batch_size ?? null;

  // Single-contact ("avulso") dispatch dialog state (kept for legacy shortcut)
  const [showAvulsoDialog, setShowAvulsoDialog] = useState(false);
  const [avulsoName, setAvulsoName] = useState("");
  const [avulsoPhone, setAvulsoPhone] = useState("");
  const [avulsoCpf, setAvulsoCpf] = useState("");
  const [avulsoContra, setAvulsoContra] = useState("");
  const [avulsoProcesso, setAvulsoProcesso] = useState("");
  const [avulsoSending, setAvulsoSending] = useState(false);

  // Non-persisted UI
  const [availableLists, setAvailableLists] = useState<{ name: string; count: number }[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [viewingList, setViewingList] = useState<string | null>(null);
  const [viewingListContacts, setViewingListContacts] = useState<{ name: string; phone: string; status: string | null; cpf?: string; lawyer_name?: string }[]>([]);
  const [loadingListContacts, setLoadingListContacts] = useState(false);
  const [deletingList, setDeletingList] = useState<string | null>(null);

  // Hydrate persisted template once allTemplates loads
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
      selectedList,
      dispatchType,
      minRenda,
      onlyVerifiedNames,
      sharedDispatch,
      dispatchMode,
      intervalSeconds,
      randomJitter412,
      batchMode,
      batchSize,
      turboLimit,
      highIncomeOnly,
      wizardStep,
    });
  }, [
    selectedPhoneNumberId, customAdvogadoName, selectedTemplate, variableMappings,
    selectedList, dispatchType, minRenda, onlyVerifiedNames, sharedDispatch, dispatchMode,
    intervalSeconds, randomJitter412, batchMode, batchSize, turboLimit,
    highIncomeOnly, wizardStep,
  ]);

  const selectedPhoneData = phones.find(p => p.phone_number_id === selectedPhoneNumberId);
  const rawDisplayName = selectedPhoneData?.verified_name || selectedPhoneData?.lawyer_name || "";
  const defaultPhoneName = rawDisplayName.includes("|") ? rawDisplayName.split("|")[0].trim() : rawDisplayName;
  const phoneVerifiedName = customAdvogadoName || defaultPhoneName;

  const approvedTemplates = allTemplates.filter(t => (t as any).status === "APPROVED");
  const templateBody = selectedTemplate ? getTemplateBody(selectedTemplate) : "";
  const templateVars = extractVariables(templateBody);

  const getContactQueueKey = (row: any) => {
    const cpfKey = String(row.cpf || "").replace(/\D/g, "");
    const rawProcess = String(row.process_number || "").trim();
    const processKey = rawProcess && !rawProcess.includes("XXXX") && rawProcess !== "Não informado" ? rawProcess : "";
    const nameKey = String(row.name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+\/\d+\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    const phoneKey = String(row.phone || "").replace(/\D/g, "");
    return cpfKey || processKey || nameKey || phoneKey;
  };

  const getUniqueContactIdsByPhone = (rows: any[]) => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const queueKey = getContactQueueKey(row);
      if (!queueKey || seen.has(queueKey)) return false;
      seen.add(queueKey);
      return true;
    }).map((row) => row.id);
  };

  // Auto-select phone if there's only one
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedPhoneNumberId]);

  // Auto-set variable mappings when template changes (only if mappings empty)
  useEffect(() => {
    if (!selectedTemplate) return;
    if (Object.keys(variableMappings).length > 0) return; // preserve persisted mappings
    const body = getTemplateBody(selectedTemplate);
    const vars = extractVariables(body);
    const defaults: Record<string, string> = {};
    vars.forEach((v, i) => {
      if (i === 0) defaults[String(v)] = "name";
      else if (i === 1) defaults[String(v)] = "process_number";
    });
    if (Object.keys(defaults).length > 0) setVariableMappings(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate]);

  // Load lists on mount only (no polling — user requested it stops flickering)
  useEffect(() => {
    refreshLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function refreshLists() {
    if (!user?.id) return;
    setLoadingLists(true);
    try {
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];
      while (from < 200000) {
        const { data, error } = await supabase
          .from("contacts")
          .select("contact_list, name, phone, cpf, process_number")
          .or(`user_id.eq.${user.id},user_id.is.null`)
          .eq("status", "novo")
          .not("contact_list", "is", null)
          .range(from, from + pageSize - 1);
        if (error || !data) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const map: Record<string, Set<string>> = {};
      all.forEach(c => {
        if (!c.contact_list) return;
        if (!map[c.contact_list]) map[c.contact_list] = new Set<string>();
        map[c.contact_list].add(getContactQueueKey(c));
      });
      setAvailableLists(
        Object.entries(map)
          .map(([name, set]) => ({ name, count: set.size }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } finally {
      setLoadingLists(false);
    }
  }

  const handleParse = () => {
    const { contacts, errors } = parseOperatorRawText(rawText);
    setParsedContacts(contacts);
    setParseErrors(errors);
    if (contacts.length > 0) setShowPreview(true);
    else toast.error("Nenhum contato encontrado. Verifique o formato.");
  };

  const handleValidateWhatsApp = async () => {
    if (parsedContacts.length === 0) return;
    setIsValidatingWa(true);
    const total = parsedContacts.length;
    setWaValidationProgress({ done: 0, total, removed: 0 });

    const BATCH_SIZE = 200;
    const validContacts: OperatorParsedContact[] = [];
    let processed = 0;

    try {
      for (let i = 0; i < parsedContacts.length; i += BATCH_SIZE) {
        const batch = parsedContacts.slice(i, i + BATCH_SIZE);
        const phonesArr = batch.map(c => String(c.phone || "").replace(/\D/g, ""));
        const { data, error } = await supabase.functions.invoke("check-whatsapp-existence", {
          body: { phones: phonesArr },
        });
        if (error) throw error;
        const results: Record<string, boolean> = data?.results || {};
        for (const c of batch) {
          const key = String(c.phone || "").replace(/\D/g, "");
          if (results[key]) validContacts.push(c);
        }
        processed += batch.length;
        setWaValidationProgress({
          done: processed,
          total,
          removed: processed - validContacts.length,
        });
      }
      setParsedContacts(validContacts);
      const removed = total - validContacts.length;
      toast.success(`Validação concluída: ${validContacts.length} com WhatsApp, ${removed} removidos`);
    } catch (err: any) {
      toast.error("Erro na validação", { description: err.message });
    } finally {
      setIsValidatingWa(false);
    }
  };

  const handleImport = () => {
    if (!listName.trim()) {
      toast.error("Informe um nome para a lista");
      return;
    }
    const parseRenda = (r?: string): number | undefined => {
      if (!r) return undefined;
      const normalized = r.includes(",") ? r.replace(/\./g, "").replace(",", ".") : r;
      const n = parseFloat(normalized);
      return isFinite(n) ? n : undefined;
    };
    const contactsToImport = parsedContacts.map(c => ({
      name: c.name,
      phone: c.phone,
      lawyer_name: c.contra || "********",
      process_number: c.process || "Não informado",
      cpf: c.cpf,
      valor_da_causa: parseRenda(c.renda),
    }));

    (async () => {
      try {
        let successful = 0;
        let failed = 0;
        for (const contact of contactsToImport) {
          const { data: existing } = await supabase
            .from("contacts")
            .select("id, status")
            .eq("phone", contact.phone)
            .or(`user_id.eq.${user!.id},user_id.is.null`)
            .neq("status", "encerrado")
            .order("last_message_at", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

          if (existing) {
            if (existing.status !== "novo") { successful++; continue; }
            const { error } = await supabase
              .from("contacts")
              .update({
                status: "novo",
                contact_list: listName.trim(),
                lawyer_name: contact.lawyer_name,
                process_number: contact.process_number,
                cpf: contact.cpf,
                ...(contact.valor_da_causa !== undefined && { valor_da_causa: contact.valor_da_causa }),
              })
              .eq("id", existing.id);
            if (error) { failed++; console.error(error); } else successful++;
          } else {
            const { error } = await supabase.from("contacts").insert({
              name: contact.name,
              phone: contact.phone,
              lawyer_name: contact.lawyer_name,
              process_number: contact.process_number,
              cpf: contact.cpf,
              valor_da_causa: contact.valor_da_causa,
              status: "novo",
              user_id: user!.id,
              contact_list: listName.trim(),
            });
            if (error) { failed++; console.error(error); } else successful++;
          }
        }
        toast.success(`Importação concluída! ${successful} contatos importados${failed > 0 ? `, ${failed} falhas` : ""}`);
        setRawText("");
        setParsedContacts([]);
        setParseErrors([]);
        setShowPreview(false);
        setListName("");
        refreshLists();
      } catch (err: any) {
        toast.error("Erro na importação", { description: err.message });
      }
    })();
  };

  // --- Re-fetch remaining contacts for the operator's pool ---
  const fetchRemainingForOperator = useCallback(async (listName: string, limit?: number, minIncome?: number): Promise<string[]> => {
    if (!user?.id) return [];
    let query = supabase
      .from("contacts")
      .select("id, name, phone, cpf, process_number")
      .eq("contact_list", listName)
      .eq("status", "novo")
      .or(`user_id.eq.${user.id},user_id.is.null`);
    if (typeof minIncome === "number") query = query.gte("valor_da_causa", minIncome);
    if (onlyVerifiedNames) query = query.eq("name_verified", true);
    if (limit) query = query.limit(limit);
    const { data } = await query;
    return getUniqueContactIdsByPhone(data || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, onlyVerifiedNames]);

  // Pre-send check: contact still in operator's pool (owned or unassigned, status novo)
  const operatorContactStillAvailable = useCallback(async (contactId: string): Promise<boolean> => {
    if (!user?.id) return false;
    const { data } = await supabase
      .from("contacts")
      .select("id, user_id, status")
      .eq("id", contactId)
      .maybeSingle();
    if (!data) return false;
    if (data.status !== "novo") return false;
    return data.user_id === null || data.user_id === user.id;
  }, [user?.id]);

  // --- Dispatch ---
  const handleSend = async () => {
    if (!cooldownReady) {
      toast.error(`Aguarde ${formatCooldown(cooldownMs)} para o próximo disparo`);
      return;
    }
    if (!selectedTemplate || !selectedList || !user?.id) return;
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }

    const isTurbo = dispatchMode === "turbo";
    const minIncomeFilter = highIncomeOnly ? 10000 : (minRenda !== "all" ? parseInt(minRenda) : undefined);

    // Admin-defined batch limit enforcement
    if (adminMaxBatchSize != null) {
      if (batchMode) {
        if (batchSize > adminMaxBatchSize) {
          toast.error(
            `Limite máximo do administrador: ${adminMaxBatchSize} contatos por disparo. Reduza a quantidade.`,
            { duration: 8000 },
          );
          return;
        }
      } else {
        // No batch mode → would send the entire list
        if (listContactCount > adminMaxBatchSize) {
          toast.error(
            `Lista possui ${listContactCount} contatos, mas o administrador limitou a ${adminMaxBatchSize} por disparo. Ative o modo lote limitado.`,
            { duration: 10000 },
          );
          return;
        }
      }
    }

    const limit = isTurbo ? turboLimit : (batchMode ? batchSize : undefined);
    let contactIds = await fetchRemainingForOperator(selectedList, limit, minIncomeFilter);

    if (contactIds.length === 0) {
      toast.error("Nenhum contato disponível nesta lista");
      return;
    }

    if (!isTurbo && contactIds.length > ANTI_BAN_DAILY_LIMIT) {
      toast.warning(`⚠️ Limite diário: máximo ${ANTI_BAN_DAILY_LIMIT} mensagens por sessão. Limitando.`, { duration: 10000 });
      contactIds = contactIds.slice(0, ANTI_BAN_DAILY_LIMIT);
    }

    const dispatchId = crypto.randomUUID();
    dispatchControlsRef.current[dispatchId] = { isPaused: false, isCancelled: false };

    const newDispatch: ActiveDispatch = {
      id: dispatchId,
      operatorName: profile?.full_name || "Operador",
      operatorId: user.id,
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
    markDispatched();

    runDispatch({
      dispatchId,
      contactIds,
      template: selectedTemplate,
      userId: user.id,
      assignedUserId: sharedDispatch ? null : user.id,
      sharedDispatch,
      selectedPhoneNumberId: selectedPhoneNumberId || undefined,
      variableMappings,
      phoneVerifiedName,
      mode: dispatchMode,
      intervalSeconds,
      randomJitter412,
      batchMode,
      batchSize,
      turboLimit,
      listName: selectedList,
      minIncome: minIncomeFilter,
      fetchRemaining: fetchRemainingForOperator,
      contactStillAvailable: operatorContactStillAvailable,
      updateDispatch,
      controlsRef: dispatchControlsRef,
      operatorDisplayName: profile?.full_name || "Operador",
      onFinally: () => refreshLists(),
    });

    toast.info("Disparo iniciado!");
  };

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
      // Upsert contact: reuse existing record for this phone if present (operator's pool)
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
        setShowAvulsoDialog(false);
        setAvulsoName(""); setAvulsoPhone(""); setAvulsoCpf("");
        setAvulsoContra(""); setAvulsoProcesso("");
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



  // --- List management ---
  const loadListContacts = async (lname: string) => {
    if (!user?.id) return;
    setViewingList(lname);
    setLoadingListContacts(true);
    const { data } = await supabase
      .from("contacts")
      .select("name, phone, status, cpf, lawyer_name")
      .eq("contact_list", lname)
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("name")
      .limit(500);
    setViewingListContacts((data || []) as any[]);
    setLoadingListContacts(false);
  };

  const handleDeleteList = async (listNameToDelete: string) => {
    if (!user?.id) return;
    const confirmed = window.confirm(`Excluir a lista "${listNameToDelete}" e todos os seus contatos? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;
    setDeletingList(listNameToDelete);
    try {
      const { data: contactIds } = await supabase
        .from("contacts")
        .select("id")
        .eq("contact_list", listNameToDelete)
        .or(`user_id.eq.${user.id},user_id.is.null`);
      const ids = (contactIds || []).map((c: any) => c.id);
      if (ids.length > 0) {
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100);
          await supabase.from("messages").delete().in("contact_id", batch);
          await supabase.from("conversations").delete().in("contact_id", batch);
          await supabase.from("contacts").delete().in("id", batch);
        }
      }
      toast.success(`Lista "${listNameToDelete}" excluída com sucesso`);
      if (selectedList === listNameToDelete) setSelectedList("");
      refreshLists();
    } catch (err: any) {
      toast.error("Erro ao excluir lista", { description: err.message });
    } finally {
      setDeletingList(null);
    }
  };

  const listContactCount = availableLists.find(l => l.name === selectedList)?.count || 0;
  const effectiveCount = batchMode ? Math.min(batchSize, listContactCount) : listContactCount;
  const avulsoPhoneDigits = avulsoPhone.replace(/\D/g, "");
  const isAvulsoValid = !!avulsoName.trim() && avulsoPhoneDigits.length >= 10;

  const isStep0Valid = phones.length === 0 || !!selectedPhoneNumberId;
  const isStep1Valid = !!selectedTemplate;
  const isStep2Valid = dispatchType === "avulso"
    ? isAvulsoValid
    : (!!selectedList && listContactCount > 0);

  // Step labels change based on dispatch type
  const stepLabels = dispatchType === "avulso"
    ? ["Número", "Template", "Contato", "Enviar"]
    : ["Número", "Template", "Lista", "Enviar"];

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
        <PageHeader title="Listas e Disparos" description="Importe contatos e dispare mensagens via WhatsApp" />

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
                                {dispatch.mode === "turbo" ? "⚡ Turbo" : dispatch.mode === "individual" ? "Individual" : "Lote"}
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

            <Tabs defaultValue="importar" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="importar" className="gap-2"><Upload className="h-4 w-4" /> Importar</TabsTrigger>
                <TabsTrigger value="listas" className="gap-2"><Users className="h-4 w-4" /> Listas</TabsTrigger>
                <TabsTrigger value="disparar" className="gap-2"><Send className="h-4 w-4" /> Disparar</TabsTrigger>
              </TabsList>

              {/* Tab: Import */}
              <TabsContent value="importar" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5 text-accent" /> Colar Lista de Contatos
                    </CardTitle>
                    <CardDescription>Cole os dados no formato NOME / CPF / TELEFONE / CONTRA / PROCESSO</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome da Lista</Label>
                      <Input value={listName} onChange={e => setListName(e.target.value)} placeholder="Ex: Lista Janeiro 2026" />
                    </div>
                    <div className="space-y-2">
                      <Label>Dados dos Contatos</Label>
                      <Textarea
                        value={rawText}
                        onChange={e => setRawText(e.target.value)}
                        placeholder={`NOME: CAIO HENRIQUE PEDRO FERREIRA  - renda $1861,27\n\nCPF: 41173349804\n\nTELEFONE: +5511970178814,+551126110638\n\nCONTRA: Qualicorp Consultoria\n\nPROCESSO: 4017392-65.2026.8.26.0100`}
                        className="min-h-[250px] font-mono text-sm"
                      />
                    </div>
                    <Button onClick={handleParse} disabled={!rawText.trim() || !listName.trim()} className="w-full" size="lg">
                      <Upload className="mr-2 h-4 w-4" /> Processar Lista
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Listas */}
              <TabsContent value="listas" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Users className="h-5 w-5 text-accent" /> Minhas Listas
                        </CardTitle>
                        <CardDescription>Visualize os contatos das listas que você importou</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={refreshLists} disabled={loadingLists}>
                        <RefreshCw className={cn("h-3.5 w-3.5", loadingLists && "animate-spin")} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loadingLists ? (
                      <LoadingSpinner size="sm" text="Carregando listas..." />
                    ) : availableLists.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhuma lista importada ainda.</p>
                    ) : (
                      <div className="space-y-2">
                        {availableLists.map(l => (
                          <div key={l.name} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{l.name}</p>
                              <p className="text-xs text-muted-foreground">{l.count} contatos</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button variant="outline" size="sm" onClick={() => loadListContacts(l.name)}>
                                <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver
                              </Button>
                              <Button variant="ghost" size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteList(l.name)}
                                disabled={deletingList === l.name}>
                                {deletingList === l.name ? <LoadingSpinner size="sm" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Dispatch — admin-style wizard with 3 modes */}
              <TabsContent value="disparar" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Send className="h-5 w-5 text-accent" /> Configurar Disparo
                    </CardTitle>

                    {/* Tipo de disparo — Lista vs Avulso (definido no início) */}
                    <div className="mt-2 rounded-lg border p-1 grid grid-cols-2 gap-1 bg-muted/30">
                      <button
                        type="button"
                        onClick={() => { setDispatchType("lista"); if (wizardStep > 2) setWizardStep(2); }}
                        className={cn(
                          "rounded-md py-1.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
                          dispatchType === "lista"
                            ? "bg-primary text-primary-foreground shadow"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Users className="h-3.5 w-3.5" /> Lista
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDispatchType("avulso"); if (wizardStep > 2) setWizardStep(2); }}
                        className={cn(
                          "rounded-md py-1.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
                          dispatchType === "avulso"
                            ? "bg-primary text-primary-foreground shadow"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" /> Avulso (1 contato)
                      </button>
                    </div>

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

                        {/* Step 2: List OR Avulso form */}
                        {wizardStep === 2 && (
                          <motion.div key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                            {dispatchType === "lista" ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label>Lista de Contatos</Label>
                                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={refreshLists} disabled={loadingLists}>
                                    <RefreshCw className={cn("h-3.5 w-3.5", loadingLists && "animate-spin")} />
                                  </Button>
                                </div>
                                {loadingLists ? (
                                  <LoadingSpinner size="sm" text="Carregando listas..." />
                                ) : availableLists.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Nenhuma lista disponível. Importe contatos primeiro.</p>
                                ) : (
                                  <Select value={selectedList} onValueChange={setSelectedList}>
                                    <SelectTrigger><SelectValue placeholder="Selecione a lista..." /></SelectTrigger>
                                    <SelectContent>
                                      {availableLists.map(l => (
                                        <SelectItem key={l.name} value={l.name}>{l.name} ({l.count} contatos)</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <Label className="text-xs font-semibold">Dados do contato avulso</Label>
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
                            )}

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

                        {/* Step 3: Mode + Send */}
                        {wizardStep === 3 && (
                          <motion.div key="s3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                            {/* Summary */}
                            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
                              <p><span className="font-semibold">Número:</span> {selectedPhoneData?.display_phone_number || "—"}</p>
                              <p><span className="font-semibold">Advogado:</span> {phoneVerifiedName || "—"}</p>
                              <p><span className="font-semibold">Template:</span> {selectedTemplate?.name || "—"}</p>
                              {dispatchType === "lista" ? (
                                <p><span className="font-semibold">Lista:</span> {selectedList} ({listContactCount} contatos)</p>
                              ) : (
                                <p><span className="font-semibold">Contato:</span> {avulsoName} — {avulsoPhone}</p>
                              )}
                              <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                                {dispatchType === "avulso" ? (
                                  <><Plus className="h-3.5 w-3.5" /> Disparo avulso</>
                                ) : (
                                  <><Layers className="h-3.5 w-3.5" /> Modo Lote</>
                                )}
                              </p>
                              {adminMaxBatchSize != null && dispatchType === "lista" && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                  Limite do administrador: {adminMaxBatchSize} contatos por disparo
                                </p>
                              )}
                            </div>

                            {/* Optional limit for the batch — only relevant for list dispatch */}
                            {dispatchType === "lista" && (
                              <div className="rounded-lg border border-border p-3 space-y-3">
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
                                    <Input
                                      id="batch-size"
                                      type="number"
                                      min={1}
                                      max={Math.min(listContactCount || 9999, adminMaxBatchSize ?? 9999)}
                                      value={batchSize}
                                      onChange={(e) => {
                                        const v = Math.max(1, parseInt(e.target.value) || 1);
                                        setBatchSize(adminMaxBatchSize != null ? Math.min(v, adminMaxBatchSize) : v);
                                      }}
                                      className="h-8 w-24 text-sm"
                                    />
                                    {adminMaxBatchSize != null && (
                                      <span className="text-[11px] text-muted-foreground">/ máx {adminMaxBatchSize}</span>
                                    )}
                                  </motion.div>
                                )}
                              </div>
                            )}


                            {dispatchType === "lista" ? (
                              <Button className="w-full gap-2" size="lg" onClick={handleSend}
                                disabled={!cooldownReady || !selectedTemplate || !selectedList || listContactCount === 0 || (phones.length > 0 && !selectedPhoneNumberId)}>
                                <Send className="h-4 w-4" />
                                {cooldownReady ? `Disparar para ${effectiveCount} contato${effectiveCount !== 1 ? "s" : ""}` : `Aguarde ${formatCooldown(cooldownMs)}`}
                              </Button>
                            ) : (
                              <Button className="w-full gap-2" size="lg" onClick={handleAvulsoSend}
                                disabled={!cooldownReady || avulsoSending || !isAvulsoValid || !selectedTemplate || (phones.length > 0 && !selectedPhoneNumberId)}>
                                {avulsoSending ? <LoadingSpinner size="sm" /> : <><Send className="h-4 w-4" /> {cooldownReady ? `Enviar para ${avulsoName || "contato"}` : `Aguarde ${formatCooldown(cooldownMs)}`}</>}
                              </Button>
                            )}
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
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Confirmar Importação</DialogTitle>
            <DialogDescription>{parsedContacts.length} contato(s) na lista "{listName}".</DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Validar números no WhatsApp</p>
                <p className="text-xs text-muted-foreground">Remove automaticamente quem não tem WhatsApp antes de importar.</p>
              </div>
            </div>
            <Button size="sm" onClick={handleValidateWhatsApp}
              disabled={parsedContacts.length === 0 || isValidatingWa}
              className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isValidatingWa ? (
                <><LoadingSpinner size="sm" /><span className="ml-2">{waValidationProgress.done}/{waValidationProgress.total}</span></>
              ) : (
                <><ShieldCheck className="mr-2 h-4 w-4" /> Validar agora</>
              )}
            </Button>
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
              <p className="font-medium">Avisos:</p>
              <ul className="list-disc pl-4 text-xs">
                {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <ScrollArea className="max-h-[400px] rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Contra</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedContacts.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                    <TableCell className="text-xs">{c.contra || "-"}</TableCell>
                    <TableCell className="text-xs">{c.process || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setParsedContacts(prev => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isValidatingWa}>Cancelar</Button>
            <Button variant="secondary" onClick={handleValidateWhatsApp} disabled={parsedContacts.length === 0 || isValidatingWa}>
              {isValidatingWa ? (
                <><LoadingSpinner size="sm" /><span className="ml-2">Validando {waValidationProgress.done}/{waValidationProgress.total}...</span></>
              ) : (
                <><ShieldCheck className="mr-2 h-4 w-4" /> Validar WhatsApp</>
              )}
            </Button>
            <Button onClick={handleImport} disabled={parsedContacts.length === 0 || isValidatingWa}>
              <Upload className="mr-2 h-4 w-4" /> Importar {parsedContacts.length} Contatos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={!!viewingList} onOpenChange={(open) => { if (!open) setViewingList(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lista: {viewingList}</DialogTitle>
            <DialogDescription>{viewingListContacts.length} contato(s) nesta lista</DialogDescription>
          </DialogHeader>
          {loadingListContacts ? (
            <div className="flex justify-center py-8"><LoadingSpinner size="md" text="Carregando contatos..." /></div>
          ) : (
            <ScrollArea className="max-h-[400px] rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Contra</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingListContacts.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{c.name}</TableCell>
                      <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                      <TableCell className="text-xs">{c.lawyer_name || "-"}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                          c.status === "novo" && "bg-info/10 text-info",
                          c.status === "aguardando" && "bg-warning/10 text-warning",
                          c.status === "respondido" && "bg-success/10 text-success",
                          c.status === "encerrado" && "bg-muted text-muted-foreground",
                        )}>
                          {c.status === "novo" ? "Novo" : c.status === "aguardando" ? "Aguardando" : c.status === "respondido" ? "Respondido" : c.status === "encerrado" ? "Encerrado" : c.status || "Novo"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingList(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Avulso Dispatch Dialog */}
      <Dialog open={showAvulsoDialog} onOpenChange={(o) => !avulsoSending && setShowAvulsoDialog(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disparar para contato avulso</DialogTitle>
            <DialogDescription>
              Cria o contato e envia o template <span className="font-mono">{selectedTemplate?.name || "—"}</span> imediatamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAvulsoDialog(false)} disabled={avulsoSending}>Cancelar</Button>
            <Button onClick={handleAvulsoSend} disabled={avulsoSending || !avulsoName.trim() || !avulsoPhone.trim()}>
              {avulsoSending ? <LoadingSpinner size="sm" /> : <><Send className="mr-2 h-4 w-4" /> Enviar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
