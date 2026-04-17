import { useState, useEffect, useRef, useCallback } from "react";
import { resilientDelay } from "@/lib/resilientDelay";
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
import { Upload, Send, List, Trash2, Pause, Play, XCircle, FileText, Phone, Radio, SkipForward, Hand, CheckCircle, X, ChevronRight, ChevronLeft, Plus, Clock, AlertCircle, Eye, Users, ShieldCheck, Brain, Zap, Shield, Coffee, Timer } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useContacts } from "@/hooks/useContacts";
import { useMetaTemplates, MetaTemplate } from "@/hooks/useMetaTemplates";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { useDispatchContext, ActiveDispatch } from "@/contexts/DispatchContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ParsedContact } from "@/types/juriszap";
import { CreateTemplateDialog } from "@/components/templates/CreateTemplateDialog";
import { cn } from "@/lib/utils";
import { getTierConfig } from "@/lib/tierLimits";

// --- Parser for the operator's raw format ---
// No number validation, accepts all phones as-is

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

  // Split by blank lines or by NOME: as separator
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
          // Normalize: remove non-digits, add 55 if needed
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

    // Create one contact per phone
    phones.forEach((phone, i) => {
      contacts.push({
        name: phones.length > 1 ? `${name} /${i + 1}` : name,
        phone,
        cpf,
        contra,
        process,
        renda,
      });
    });
  }

  return { contacts, errors };
}

// --- Dispatch helpers (copied from admin, simplified) ---

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

function DispatchNextSendCountdown({ nextSendAt }: { nextSendAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const ms = new Date(nextSendAt).getTime() - Date.now();
      if (ms <= 0) { setRemaining(""); return; }
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextSendAt]);

  if (!remaining) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
      <Timer className="h-3 w-3 animate-pulse" />
      <span>Próximo envio em <span className="font-mono tabular-nums">{remaining}</span></span>
    </div>
  );
}

export default function OperatorDisparosPage() {
  const { user, profile } = useAuthContext();
  const { importContacts, isImporting } = useContacts();
  const { templates, allTemplates, createTemplate, isCreatingTemplate, refetch: refetchTemplates } = useMetaTemplates();
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

  // Import state
  const [rawText, setRawText] = useState("");
  const [parsedContacts, setParsedContacts] = useState<OperatorParsedContact[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [listName, setListName] = useState("");

  // Dispatch state
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});
  const [selectedList, setSelectedList] = useState("");
  const [availableLists, setAvailableLists] = useState<{ name: string; count: number }[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(65);
  const [dispatchMode, setDispatchMode] = useState<"auto" | "manual" | "smart" | "tier">("tier");
  const [smartLimit, setSmartLimit] = useState<number>(0); // 0 = sem limite
  const [minRenda, setMinRenda] = useState<string>("all");
  const [onlyVerifiedNames, setOnlyVerifiedNames] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [viewingList, setViewingList] = useState<string | null>(null);
  const [viewingListContacts, setViewingListContacts] = useState<{ name: string; phone: string; status: string | null; cpf?: string; lawyer_name?: string }[]>([]);
  const [loadingListContacts, setLoadingListContacts] = useState(false);
  const [deletingList, setDeletingList] = useState<string | null>(null);

  // Manual dispatch state
  const [manualContacts, setManualContacts] = useState<{ id: string; name: string; phone: string; status?: string }[]>([]);
  const [manualIndex, setManualIndex] = useState(0);
  const [manualSending, setManualSending] = useState(false);
  const [manualResults, setManualResults] = useState({ sent: 0, failed: 0 });

  const selectedPhoneData = phones.find(p => p.phone_number_id === selectedPhoneNumberId);
  const rawDisplayName = selectedPhoneData?.verified_name || selectedPhoneData?.lawyer_name || "";
  const defaultPhoneName = rawDisplayName.includes("|") ? rawDisplayName.split("|")[0].trim() : rawDisplayName;
  const [customAdvogadoName, setCustomAdvogadoName] = useState("");
  const phoneVerifiedName = customAdvogadoName || defaultPhoneName;

  const approvedTemplates = allTemplates.filter(t => (t as any).status === "APPROVED");
  const templateBody = selectedTemplate ? getTemplateBody(selectedTemplate) : "";
  const templateVars = extractVariables(templateBody);

  // Auto-select phone
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
    setCustomAdvogadoName("");
  }, [phones, selectedPhoneNumberId]);

  // Auto-set variable mappings when template changes
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

  // Refresh lists
  useEffect(() => {
    refreshLists();
    const interval = setInterval(refreshLists, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  function refreshLists() {
    if (!user?.id) return;
    setLoadingLists(true);
    supabase
      .from("contacts")
      .select("contact_list")
      .eq("user_id", user.id)
      .not("contact_list", "is", null)
      .limit(50000)
      .then(({ data }) => {
        if (!data) { setLoadingLists(false); return; }
        const map: Record<string, number> = {};
        (data as any[]).forEach(c => {
          if (c.contact_list) map[c.contact_list] = (map[c.contact_list] || 0) + 1;
        });
        setAvailableLists(
          Object.entries(map)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setLoadingLists(false);
      });
  }

  const handleParse = () => {
    const { contacts, errors } = parseOperatorRawText(rawText);
    setParsedContacts(contacts);
    setParseErrors(errors);
    if (contacts.length > 0) setShowPreview(true);
    else toast.error("Nenhum contato encontrado. Verifique o formato.");
  };

  const handleImport = () => {
    if (!listName.trim()) {
      toast.error("Informe um nome para a lista");
      return;
    }
    const contactsToImport: ParsedContact[] = parsedContacts.map(c => ({
      name: c.name,
      phone: c.phone,
      lawyer_name: c.contra || "********",
      process_number: c.process || "Não informado",
      cpf: c.cpf,
    }));

    // Import with contact_list name — use direct supabase insert for operator's own contacts
    (async () => {
      try {
        let successful = 0;
        let failed = 0;
        for (const contact of contactsToImport) {
          // Check if contact with same phone already exists for this operator
          const { data: existing } = await supabase
            .from("contacts")
            .select("id")
            .eq("phone", contact.phone)
            .eq("user_id", user!.id)
            .neq("status", "encerrado")
            .order("last_message_at", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

          if (existing) {
            // Reuse existing contact: update status back to "novo" and refresh list name
            const { error } = await supabase
              .from("contacts")
              .update({
                status: "novo",
                contact_list: listName.trim(),
                lawyer_name: contact.lawyer_name,
                process_number: contact.process_number,
                cpf: contact.cpf,
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

  // --- Dispatch ---
  const handleSend = async () => {
    if (!selectedTemplate || !selectedList || !user?.id) return;
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }

    // Fetch contacts from operator's own list with renda filter
    let query = supabase
      .from("contacts")
      .select("id")
      .eq("contact_list", selectedList)
      .eq("user_id", user.id)
      .eq("status", "novo");

    if (minRenda !== "all") {
      query = query.gte("valor_da_causa", parseInt(minRenda));
    }
    if (onlyVerifiedNames) {
      query = query.eq("name_verified", true);
    }

    const { data: contactsData } = await query;
    const contactIds = (contactsData || []).map((c: any) => c.id);
    if (contactIds.length === 0) {
      toast.error("Nenhum contato disponível nesta lista");
      return;
    }

    const dispatchId = crypto.randomUUID();
    dispatchControlsRef.current[dispatchId] = { isPaused: false, isCancelled: false };

    const newDispatch: ActiveDispatch = {
      id: dispatchId,
      operatorName: profile?.full_name || "Operador",
      operatorId: user.id,
      templateName: selectedTemplate.name,
      listName: selectedList,
      mode: "individual",
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

    const capturedTemplate = selectedTemplate;
    const capturedPhoneId = selectedPhoneNumberId;
    const capturedMappings = { ...variableMappings };
    const capturedPhoneVerifiedName = phoneVerifiedName;
    const capturedInterval = intervalSeconds;
    const capturedListName = selectedList;

    // Run dispatch in background
    (async () => {
      const results = { sent: 0, failed: 0, errors: [] as string[] };
      let consecutiveErrors = 0;

      try {
        for (let i = 0; i < contactIds.length; i++) {
          const ctrl = dispatchControlsRef.current[dispatchId];
          if (ctrl?.isCancelled) break;

          if (ctrl?.isPaused) {
            while (ctrl?.isPaused && !ctrl?.isCancelled) {
              await new Promise(r => setTimeout(r, 500));
            }
            if (ctrl?.isCancelled) break;
          }

          const contactId = contactIds[i];

          const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
            body: {
              contactIds: [contactId],
              templateName: capturedTemplate.name,
              templateLanguage: capturedTemplate.language,
              userId: user?.id,
              assignedUserId: user?.id,
              selectedPhoneNumberId: capturedPhoneId || undefined,
              variableMappings: capturedMappings,
              phoneVerifiedName: capturedPhoneVerifiedName,
            },
          });

          if (!sendError && result?.results) {
            results.sent += result.results.sent || 0;
            results.failed += result.results.failed || 0;
            if (result.results.errors) results.errors.push(...result.results.errors);

            if (result.results.errors?.some((e: string) => e.includes("Conta Business bloqueada"))) {
              toast.error("🛑 Conta bloqueada! Parando.");
              break;
            }
            consecutiveErrors = 0;
          } else {
            results.failed++;
            consecutiveErrors++;
            if (sendError) {
              const msg = sendError?.message || "Erro desconhecido";
              results.errors.push(msg);
            }

            if (consecutiveErrors >= 3) {
              toast.warning("🚨 3 erros consecutivos! Cooldown 5 min...");
              await new Promise(r => setTimeout(r, 5 * 60 * 1000));
              consecutiveErrors = 0;
              const ctrl2 = dispatchControlsRef.current[dispatchId];
              if (ctrl2?.isCancelled) break;
            }
          }

          updateDispatch(dispatchId, {
            current: results.sent + results.failed,
            sent: results.sent,
            failed: results.failed,
            errors: [...results.errors],
          });

          // Delay with jitter: always above 60s, varies 5-25% above base
          if (i < contactIds.length - 1 && !ctrl?.isCancelled) {
            const safeBase = Math.max(capturedInterval, 60);
            const baseDelayMs = safeBase * 1000;
            const jitterMs = Math.floor(baseDelayMs * (0.05 + Math.random() * 0.20));
            const delayMs = baseDelayMs + jitterMs;

            // Set nextSendAt for countdown display
            const nextAt = new Date(Date.now() + delayMs).toISOString();
            updateDispatch(dispatchId, {
              current: results.sent + results.failed,
              sent: results.sent,
              failed: results.failed,
              errors: [...results.errors],
              nextSendAt: nextAt,
            });

            const waited = await resilientDelay(delayMs, () => dispatchControlsRef.current[dispatchId]);
            if (!waited) break;

            // Clear nextSendAt after delay
            updateDispatch(dispatchId, { nextSendAt: undefined });
          }
        }

        const ctrl = dispatchControlsRef.current[dispatchId];
        if (ctrl?.isCancelled) {
          toast.warning(`Cancelado — ${results.sent} enviados, ${results.failed} falhas`);
        } else if (results.failed > 0) {
          toast.error(`Concluído com falhas — ${results.sent} enviados, ${results.failed} falhas`);
        } else {
          toast.success(`Concluído — ${results.sent} enviados!`);
        }
      } catch (err: any) {
        toast.error("Erro no disparo", { description: err.message });
      } finally {
        updateDispatch(dispatchId, { isFinished: true });
        delete dispatchControlsRef.current[dispatchId];
        refreshLists();
      }
    })();

    toast.info("Disparo iniciado!");
  };

  // --- Manual Dispatch ---
  const handleStartManual = async () => {
    if (!selectedTemplate || !selectedList || !user?.id) return;
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }

    let manualQuery = supabase
      .from("contacts")
      .select("id, name, phone")
      .eq("contact_list", selectedList)
      .eq("user_id", user.id)
      .eq("status", "novo");

    if (minRenda !== "all") {
      manualQuery = manualQuery.gte("valor_da_causa", parseInt(minRenda));
    }
    if (onlyVerifiedNames) {
      manualQuery = manualQuery.eq("name_verified", true);
    }

    const { data: contactsData } = await manualQuery;

    const contacts = (contactsData || []).map((c: any) => ({ id: c.id, name: c.name, phone: c.phone }));
    if (contacts.length === 0) {
      toast.error("Nenhum contato disponível nesta lista");
      return;
    }

    setManualContacts(contacts);
    setManualIndex(0);
    setManualResults({ sent: 0, failed: 0 });
    toast.info(`Modo manual iniciado — ${contacts.length} contatos na fila`);
  };

  const handleManualSendOne = async () => {
    if (manualIndex >= manualContacts.length || !selectedTemplate || !user?.id) return;
    setManualSending(true);
    const contact = manualContacts[manualIndex];

    try {
      const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
        body: {
          contactIds: [contact.id],
          templateName: selectedTemplate.name,
          templateLanguage: selectedTemplate.language,
          userId: user.id,
          assignedUserId: user.id,
          selectedPhoneNumberId: selectedPhoneNumberId || undefined,
          variableMappings,
          phoneVerifiedName,
        },
      });

      if (!sendError && result?.results) {
        if (result.results.sent > 0) {
          setManualContacts(prev => prev.map((c, i) => i === manualIndex ? { ...c, status: "sent" } : c));
          setManualResults(prev => ({ ...prev, sent: prev.sent + 1 }));
          toast.success(`✅ Enviado para ${contact.name}`);
        } else {
          const errMsg = result.results.errors?.[0] || "Falha no envio";
          setManualContacts(prev => prev.map((c, i) => i === manualIndex ? { ...c, status: "failed" } : c));
          setManualResults(prev => ({ ...prev, failed: prev.failed + 1 }));
          toast.error(`Falha: ${contact.name}`, { description: errMsg });
        }
      } else {
        setManualContacts(prev => prev.map((c, i) => i === manualIndex ? { ...c, status: "failed" } : c));
        setManualResults(prev => ({ ...prev, failed: prev.failed + 1 }));
        toast.error(`Erro ao enviar para ${contact.name}`, { description: sendError?.message });
      }

      setManualIndex(prev => prev + 1);
    } catch (err: any) {
      toast.error("Erro no envio", { description: err.message });
      setManualContacts(prev => prev.map((c, i) => i === manualIndex ? { ...c, status: "failed" } : c));
      setManualResults(prev => ({ ...prev, failed: prev.failed + 1 }));
      setManualIndex(prev => prev + 1);
    } finally {
      setManualSending(false);
    }
  };

  const handleManualSkip = () => {
    if (manualIndex >= manualContacts.length) return;
    setManualContacts(prev => prev.map((c, i) => i === manualIndex ? { ...c, status: "skipped" } : c));
    setManualIndex(prev => prev + 1);
    toast.info("Contato pulado");
  };

  const handleManualStop = () => {
    const sent = manualResults.sent;
    const failed = manualResults.failed;
    setManualContacts([]);
    setManualIndex(0);
    toast.warning(`Manual encerrado — ${sent} enviados, ${failed} falhas`);
  };

  // --- Smart Dispatch (warm-up + breathing + failure monitoring) ---
  const SMART_PHASES = [
    { name: "Aquecimento", minDelay: 45, maxDelay: 90, msgsInPhase: 20 },
    { name: "Acelerando", minDelay: 25, maxDelay: 50, msgsInPhase: 30 },
    { name: "Progressão", minDelay: 15, maxDelay: 35, msgsInPhase: 50 },
    { name: "Cruzeiro", minDelay: 10, maxDelay: 20, msgsInPhase: Infinity },
  ];

  const handleSmartSend = async () => {
    if (!selectedTemplate || !selectedList || !user?.id) return;
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }

    let query = supabase
      .from("contacts")
      .select("id")
      .eq("contact_list", selectedList)
      .eq("user_id", user.id)
      .eq("status", "novo");

    if (minRenda !== "all") query = query.gte("valor_da_causa", parseInt(minRenda));
    if (onlyVerifiedNames) query = query.eq("name_verified", true);

    const { data: contactsData } = await query;
    let contactIds = (contactsData || []).map((c: any) => c.id);
    if (contactIds.length === 0) {
      toast.error("Nenhum contato disponível nesta lista");
      return;
    }
    // Apply smart limit if set
    if (smartLimit > 0 && contactIds.length > smartLimit) {
      contactIds = contactIds.slice(0, smartLimit);
    }

    const dispatchId = crypto.randomUUID();
    dispatchControlsRef.current[dispatchId] = { isPaused: false, isCancelled: false };

    const newDispatch: ActiveDispatch = {
      id: dispatchId,
      operatorName: profile?.full_name || "Operador",
      operatorId: user.id,
      templateName: selectedTemplate.name,
      listName: selectedList,
      mode: "smart",
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

    const capturedTemplate = selectedTemplate;
    const capturedPhoneId = selectedPhoneNumberId;
    const capturedMappings = { ...variableMappings };
    const capturedPhoneVerifiedName = phoneVerifiedName;

    (async () => {
      const results = { sent: 0, failed: 0, errors: [] as string[] };
      let consecutiveErrors = 0;
      let currentPhase = 0;
      let msgsInCurrentPhase = 0;
      let totalSentInSession = 0;
      const MAX_DAILY = 800;

      try {
        for (let i = 0; i < contactIds.length; i++) {
          const ctrl = dispatchControlsRef.current[dispatchId];
          if (ctrl?.isCancelled) break;

          // Pause check
          if (ctrl?.isPaused) {
            while (ctrl?.isPaused && !ctrl?.isCancelled) {
              await new Promise(r => setTimeout(r, 500));
            }
            if (ctrl?.isCancelled) break;
          }

          // Daily limit check
          if (totalSentInSession >= MAX_DAILY) {
            toast.warning(`🛡️ Limite diário de ${MAX_DAILY} mensagens atingido. Parando para proteger a conta.`);
            break;
          }

          // Smart time window check (08:00-11:30, 13:30-17:00 BRT)
          const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
          const hour = nowBrt.getHours();
          const min = nowBrt.getMinutes();
          const timeInMinutes = hour * 60 + min;
          const morningStart = 8 * 60;    // 08:00
          const morningEnd = 11 * 60 + 30; // 11:30
          const afternoonStart = 13 * 60 + 30; // 13:30
          const afternoonEnd = 17 * 60;    // 17:00

          const inWindow = (timeInMinutes >= morningStart && timeInMinutes < morningEnd) ||
                           (timeInMinutes >= afternoonStart && timeInMinutes < afternoonEnd);

          if (!inWindow) {
            // Calculate wait until next window
            let waitMinutes = 0;
            if (timeInMinutes < morningStart) {
              waitMinutes = morningStart - timeInMinutes;
            } else if (timeInMinutes >= morningEnd && timeInMinutes < afternoonStart) {
              waitMinutes = afternoonStart - timeInMinutes;
            } else {
              // After 17:00, wait until next day 08:00
              waitMinutes = (24 * 60 - timeInMinutes) + morningStart;
            }

            toast.info(`⏰ Fora da janela horária segura. Aguardando ${waitMinutes} minutos...`);
            updateDispatch(dispatchId, {
              breathingUntil: new Date(Date.now() + waitMinutes * 60 * 1000).toISOString(),
            });

            // Wait using wall-clock time
            await resilientDelay(waitMinutes * 60 * 1000, () => dispatchControlsRef.current[dispatchId], 10000);
            updateDispatch(dispatchId, { breathingUntil: undefined });
            const c2 = dispatchControlsRef.current[dispatchId];
            if (c2?.isCancelled) break;
          }

          // Send
          const contactId = contactIds[i];
          const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
            body: {
              contactIds: [contactId],
              templateName: capturedTemplate.name,
              templateLanguage: capturedTemplate.language,
              userId: user?.id,
              assignedUserId: user?.id,
              selectedPhoneNumberId: capturedPhoneId || undefined,
              variableMappings: capturedMappings,
              phoneVerifiedName: capturedPhoneVerifiedName,
            },
          });

          if (!sendError && result?.results) {
            results.sent += result.results.sent || 0;
            results.failed += result.results.failed || 0;
            if (result.results.errors) results.errors.push(...result.results.errors);

            // Circuit breaker for block errors
            if (result.results.errors?.some((e: string) =>
              e.includes("Conta Business bloqueada") || e.includes("131031") || e.includes("131051") || e.includes("131042")
            )) {
              // Downgrade phase
              if (currentPhase > 0) {
                currentPhase = Math.max(0, currentPhase - 1);
                msgsInCurrentPhase = 0;
                toast.warning(`🛡️ Erro de bloqueio detectado! Voltando para fase "${SMART_PHASES[currentPhase].name}". Pausa de 5 minutos...`);
                updateDispatch(dispatchId, { breathingUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
                await new Promise(r => setTimeout(r, 5 * 60 * 1000));
                updateDispatch(dispatchId, { breathingUntil: undefined });
              } else {
                toast.error("🛑 Erro de bloqueio na fase de aquecimento! Encerrando para proteger a conta.");
                break;
              }
              const ctrl3 = dispatchControlsRef.current[dispatchId];
              if (ctrl3?.isCancelled) break;
            }

            if (result.results.sent > 0) {
              consecutiveErrors = 0;
              totalSentInSession++;
              msgsInCurrentPhase++;
            }
          } else {
            results.failed++;
            consecutiveErrors++;
            if (sendError) results.errors.push(sendError?.message || "Erro desconhecido");

            if (consecutiveErrors >= 3) {
              // Downgrade phase + cooldown
              currentPhase = Math.max(0, currentPhase - 1);
              msgsInCurrentPhase = 0;
              toast.warning(`🚨 3 erros consecutivos! Cooldown 5 min + voltando para "${SMART_PHASES[currentPhase].name}"...`);
              updateDispatch(dispatchId, { breathingUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
              await resilientDelay(5 * 60 * 1000, () => dispatchControlsRef.current[dispatchId], 10000);
              updateDispatch(dispatchId, { breathingUntil: undefined });
              consecutiveErrors = 0;
              const ctrl4 = dispatchControlsRef.current[dispatchId];
              if (ctrl4?.isCancelled) break;
            }
          }

          // Failure rate check (> 3% = emergency pause 15min)
          const totalProcessed = results.sent + results.failed;
          if (totalProcessed > 10) {
            const failRate = (results.failed / totalProcessed) * 100;
            if (failRate > 3) {
              toast.warning(`⚠️ Taxa de falha ${failRate.toFixed(1)}% (> 3%). Pausa de emergência 15 minutos...`);
              updateDispatch(dispatchId, { breathingUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
              const emergencyWaited = await resilientDelay(15 * 60 * 1000, () => dispatchControlsRef.current[dispatchId], 10000);
              updateDispatch(dispatchId, { breathingUntil: undefined });
              const c5 = dispatchControlsRef.current[dispatchId];
              if (c5?.isCancelled) break;
            }
          }

          updateDispatch(dispatchId, {
            current: results.sent + results.failed,
            sent: results.sent,
            failed: results.failed,
            errors: [...results.errors],
          });

          // Phase progression
          const phase = SMART_PHASES[currentPhase];
          if (msgsInCurrentPhase >= phase.msgsInPhase && currentPhase < SMART_PHASES.length - 1) {
            currentPhase++;
            msgsInCurrentPhase = 0;
            toast.info(`📈 Avançando para fase "${SMART_PHASES[currentPhase].name}"`);
          }

          // Breathing pause: 2 minutes every 30 messages
          if (totalSentInSession > 0 && totalSentInSession % 30 === 0) {
            const pauseMs = 2 * 60 * 1000;
            toast.info(`🫁 Pausa de 2 minutos a cada 30 mensagens (proteção anti-bloqueio)...`);
            updateDispatch(dispatchId, { breathingUntil: new Date(Date.now() + pauseMs).toISOString() });
            await resilientDelay(pauseMs, () => dispatchControlsRef.current[dispatchId], 10000);
            updateDispatch(dispatchId, { breathingUntil: undefined });
          }

          // Delay between messages (phase-based)
          if (i < contactIds.length - 1 && !ctrl?.isCancelled) {
            const currentPh = SMART_PHASES[currentPhase];
            const delaySeconds = randomBetween(currentPh.minDelay, currentPh.maxDelay);
            const delayMs = delaySeconds * 1000;

            const nextAt = new Date(Date.now() + delayMs).toISOString();
            updateDispatch(dispatchId, { nextSendAt: nextAt });

            const waited = await resilientDelay(delayMs, () => dispatchControlsRef.current[dispatchId]);
            if (!waited) break;
            updateDispatch(dispatchId, { nextSendAt: undefined });
          }
        }

        const ctrl = dispatchControlsRef.current[dispatchId];
        if (ctrl?.isCancelled) {
          toast.warning(`Cancelado — ${results.sent} enviados, ${results.failed} falhas`);
        } else if (results.failed > 0) {
          toast.error(`Concluído com falhas — ${results.sent} enviados, ${results.failed} falhas`);
        } else {
          toast.success(`✅ Disparo inteligente concluído — ${results.sent} enviados!`);
        }
      } catch (err: any) {
        toast.error("Erro no disparo", { description: err.message });
      } finally {
        updateDispatch(dispatchId, { isFinished: true });
        delete dispatchControlsRef.current[dispatchId];
        refreshLists();
      }
    })();

    toast.info("🧠 Disparo inteligente iniciado!");
  };

  const manualFinished = manualContacts.length > 0 && manualIndex >= manualContacts.length;
  const currentManualContact = manualContacts[manualIndex] || null;

  const loadListContacts = async (listName: string) => {
    if (!user?.id) return;
    setViewingList(listName);
    setLoadingListContacts(true);
    const { data } = await supabase
      .from("contacts")
      .select("name, phone, status, cpf, lawyer_name")
      .eq("user_id", user.id)
      .eq("contact_list", listName)
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
      // Get contact IDs first
      const { data: contactIds } = await supabase
        .from("contacts")
        .select("id")
        .eq("user_id", user.id)
        .eq("contact_list", listNameToDelete);
      
      const ids = (contactIds || []).map((c: any) => c.id);
      
      if (ids.length > 0) {
        // Delete messages and conversations in batches
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

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
        <PageHeader
          title="Listas e Disparos"
          description="Importe contatos e dispare mensagens via WhatsApp"
        />

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
                      <motion.div
                        key={dispatch.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className={`rounded-lg border p-3 space-y-2 ${dispatch.isFinished ? "border-muted" : "border-primary/30 bg-primary/5"}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="outline" className="text-[10px]">{dispatch.templateName}</Badge>
                              <Badge variant="secondary" className="text-[10px]">{dispatch.listName}</Badge>
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
                          {/* Countdown to next send */}
                          {dispatch.nextSendAt && !dispatch.isFinished && !dispatch.isPaused && (
                            <DispatchNextSendCountdown nextSendAt={dispatch.nextSendAt} />
                          )}
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
                <TabsTrigger value="importar" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Importar
                </TabsTrigger>
                <TabsTrigger value="listas" className="gap-2">
                  <Users className="h-4 w-4" />
                  Listas
                </TabsTrigger>
                <TabsTrigger value="disparar" className="gap-2">
                  <Send className="h-4 w-4" />
                  Disparar
                </TabsTrigger>
              </TabsList>

              {/* Tab: Import */}
              <TabsContent value="importar" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5 text-accent" />
                      Colar Lista de Contatos
                    </CardTitle>
                    <CardDescription>
                      Cole os dados no formato NOME / CPF / TELEFONE / CONTRA / PROCESSO
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome da Lista</Label>
                      <Input
                        value={listName}
                        onChange={e => setListName(e.target.value)}
                        placeholder="Ex: Lista Janeiro 2026"
                      />
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
                      <Upload className="mr-2 h-4 w-4" />
                      Processar Lista
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Listas */}
              <TabsContent value="listas" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-5 w-5 text-accent" />
                      Minhas Listas
                    </CardTitle>
                    <CardDescription>
                      Visualize os contatos das listas que você importou
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loadingLists ? (
                      <LoadingSpinner size="sm" text="Carregando listas..." />
                    ) : availableLists.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhuma lista importada ainda.</p>
                    ) : (
                      <div className="space-y-2">
                        {availableLists.map(l => (
                          <div
                            key={l.name}
                            className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{l.name}</p>
                              <p className="text-xs text-muted-foreground">{l.count} contatos</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadListContacts(l.name)}
                              >
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                Ver
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteList(l.name)}
                                disabled={deletingList === l.name}
                              >
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

              {/* Tab: Dispatch */}
              <TabsContent value="disparar" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Send className="h-5 w-5 text-accent" />
                      Configurar Disparo
                    </CardTitle>
                    {/* Step indicators */}
                    <div className="flex items-center gap-1 pt-2">
                      {["Número", "Template", "Lista", "Enviar"].map((label, i) => (
                        <div key={i} className="flex items-center gap-1 flex-1">
                          <button
                            onClick={() => i < wizardStep && setWizardStep(i)}
                            className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 transition-colors ${
                              i === wizardStep
                                ? "bg-primary text-primary-foreground"
                                : i < wizardStep
                                ? "bg-primary/20 text-primary cursor-pointer"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
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
                      {/* Step 0: Phone selection */}
                      {wizardStep === 0 && (
                        <motion.div
                          key="step-0"
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -30 }}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <Label>Número de Disparo</Label>
                            {phones.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nenhum número disponível. Registre um número primeiro.</p>
                            ) : (
                              <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o número..." />
                                </SelectTrigger>
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
                              <Input
                                value={customAdvogadoName}
                                onChange={e => setCustomAdvogadoName(e.target.value)}
                                placeholder={defaultPhoneName || "Nome do advogado..."}
                                className="h-9"
                              />
                              <p className="text-xs text-muted-foreground">
                                Derivado do nome de exibição: <span className="font-mono">{rawDisplayName}</span>
                              </p>
                            </div>
                          )}

                          <div className="flex justify-end pt-2">
                            <Button
                              onClick={() => setWizardStep(1)}
                              disabled={phones.length > 0 && !selectedPhoneNumberId}
                            >
                              Próximo <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 1: Template selection */}
                      {wizardStep === 1 && (
                        <motion.div
                          key="step-1"
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -30 }}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Template</Label>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setShowCreateTemplate(true)}
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Criar Template
                              </Button>
                            </div>
                            <Select
                              value={selectedTemplate?.name || ""}
                              onValueChange={v => setSelectedTemplate(approvedTemplates.find(t => t.name === v) || null)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o template aprovado..." />
                              </SelectTrigger>
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

                          {/* Template Preview */}
                          {selectedTemplate && templateBody && (
                            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-semibold text-muted-foreground">Preview do Template</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{templateBody}</p>
                            </div>
                          )}

                          {/* Variable mappings */}
                          {templateVars.length > 0 && (
                            <div className="space-y-2 rounded-lg border p-3">
                              <Label className="text-xs font-semibold">Mapeamento de Variáveis</Label>
                              {templateVars.map(v => (
                                <div key={v} className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs shrink-0">{`{{${v}}}`}</Badge>
                                  <Select
                                    value={variableMappings[String(v)] || ""}
                                    onValueChange={val => setVariableMappings(prev => ({ ...prev, [String(v)]: val }))}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Campo..." />
                                    </SelectTrigger>
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
                            <Button onClick={() => setWizardStep(2)} disabled={!selectedTemplate}>
                              Próximo <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 2: List + Renda filter */}
                      {wizardStep === 2 && (
                        <motion.div
                          key="step-2"
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -30 }}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <Label>Lista de Contatos</Label>
                            {loadingLists ? (
                              <LoadingSpinner size="sm" text="Carregando listas..." />
                            ) : availableLists.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nenhuma lista disponível. Importe contatos primeiro.</p>
                            ) : (
                              <Select value={selectedList} onValueChange={setSelectedList}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a lista..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableLists.map(l => (
                                    <SelectItem key={l.name} value={l.name}>
                                      {l.name} ({l.count} contatos)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Filtro de Renda</Label>
                            <Select value={minRenda} onValueChange={setMinRenda}>
                              <SelectTrigger>
                                <SelectValue placeholder="Todos os contatos" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todos (sem filtro)</SelectItem>
                                <SelectItem value="5000">Acima de R$ 5.000</SelectItem>
                                <SelectItem value="10000">Acima de R$ 10.000</SelectItem>
                                <SelectItem value="15000">Acima de R$ 15.000</SelectItem>
                                <SelectItem value="20000">Acima de R$ 20.000</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Filtra contatos pelo valor da causa/renda mínima.
                            </p>
                          </div>

                          {/* Name verified filter */}
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-green-500" />
                              Filtro de Nome Verificado
                            </Label>
                            <div
                              className={cn(
                                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                onlyVerifiedNames ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "hover:bg-muted/50"
                              )}
                              onClick={() => setOnlyVerifiedNames(!onlyVerifiedNames)}
                            >
                              <Checkbox
                                checked={onlyVerifiedNames}
                                onCheckedChange={(v) => setOnlyVerifiedNames(!!v)}
                              />
                              <div>
                                <p className="text-sm font-medium">Somente nomes confirmados</p>
                                <p className="text-xs text-muted-foreground">
                                  Envia apenas para contatos cujo nome do WhatsApp corresponde ao nome cadastrado.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between pt-2">
                            <Button variant="outline" onClick={() => setWizardStep(1)}>
                              <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                            </Button>
                            <Button onClick={() => setWizardStep(3)} disabled={!selectedList}>
                              Próximo <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 3: Mode + Send */}
                      {wizardStep === 3 && (
                        <motion.div
                          key="step-3"
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -30 }}
                          className="space-y-4"
                        >
                          {/* Summary */}
                          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
                            <p><span className="font-semibold">Número:</span> {selectedPhoneData?.display_phone_number || "—"}</p>
                            <p><span className="font-semibold">Advogado:</span> {phoneVerifiedName || "—"}</p>
                            <p><span className="font-semibold">Template:</span> {selectedTemplate?.name || "—"}</p>
                            <p><span className="font-semibold">Lista:</span> {selectedList} ({listContactCount} contatos)</p>
                            {minRenda !== "all" && (
                              <p><span className="font-semibold">Renda mín.:</span> R$ {parseInt(minRenda).toLocaleString("pt-BR")}</p>
                            )}
                            {onlyVerifiedNames && (
                              <p className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-green-500" /><span className="font-semibold">Somente nomes verificados</span></p>
                            )}
                          </div>

                          {/* Mode selection */}
                          <div className="space-y-2">
                            <Label>Modo de Disparo</Label>
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                onClick={() => setDispatchMode("smart")}
                                className={cn(
                                  "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all",
                                  dispatchMode === "smart"
                                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                                    : "hover:bg-muted/50"
                                )}
                              >
                                <Brain className="h-5 w-5 text-primary" />
                                <span className="text-xs font-semibold">Inteligente</span>
                                <span className="text-[10px] text-muted-foreground leading-tight">Anti-bloqueio</span>
                              </button>
                              <button
                                onClick={() => setDispatchMode("auto")}
                                className={cn(
                                  "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all",
                                  dispatchMode === "auto"
                                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                                    : "hover:bg-muted/50"
                                )}
                              >
                                <Send className="h-5 w-5" />
                                <span className="text-xs font-semibold">Automático</span>
                                <span className="text-[10px] text-muted-foreground leading-tight">Intervalo fixo</span>
                              </button>
                              <button
                                onClick={() => setDispatchMode("manual")}
                                className={cn(
                                  "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all",
                                  dispatchMode === "manual"
                                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                                    : "hover:bg-muted/50"
                                )}
                              >
                                <Hand className="h-5 w-5" />
                                <span className="text-xs font-semibold">Manual</span>
                                <span className="text-[10px] text-muted-foreground leading-tight">1 a 1</span>
                              </button>
                            </div>
                          </div>

                          {/* Smart mode info + button */}
                          {dispatchMode === "smart" && (
                            <div className="space-y-3">
                              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-semibold">Modo Inteligente 🧠</span>
                                </div>
                                <ul className="text-xs text-muted-foreground space-y-1 pl-6 list-disc">
                                  <li><strong>Warm-up:</strong> Começa lento (45-90s) e acelera em 4 fases</li>
                                  <li><strong>Pausas:</strong> 2 minutos a cada 30 mensagens</li>
                                  <li><strong>Janela horária:</strong> Envia apenas 08:00-11:30 e 13:30-17:00</li>
                                  <li><strong>Limite:</strong> Máx. 800 msgs/dia por sessão</li>
                                  <li><strong>Auto-proteção:</strong> Taxa de falha {'>'} 3% = pausa de 15min</li>
                                </ul>
                              </div>
                              <div className="space-y-2">
                                <Label>Limite de envios (0 = sem limite)</Label>
                                <Input
                                  type="number"
                                  value={smartLimit}
                                  onChange={e => setSmartLimit(Math.max(0, parseInt(e.target.value) || 0))}
                                  min={0}
                                  placeholder="Ex: 100"
                                  className="w-40"
                                />
                                <p className="text-xs text-muted-foreground">
                                  {smartLimit > 0
                                    ? `Enviará no máximo ${smartLimit} mensagens desta lista.`
                                    : "Enviará para todos os contatos disponíveis (respeitando o limite diário de 800)."}
                                </p>
                              </div>
                              <Button
                                onClick={handleSmartSend}
                                disabled={!selectedTemplate || !selectedList || listContactCount === 0}
                                className="w-full"
                                size="lg"
                              >
                                <Brain className="mr-2 h-4 w-4" />
                                Iniciar Disparo Inteligente ({smartLimit > 0 ? Math.min(smartLimit, listContactCount) : listContactCount} contatos)
                              </Button>
                            </div>
                          )}


                          {dispatchMode === "auto" && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label>Intervalo entre mensagens (segundos)</Label>
                                <Input
                                  type="number"
                                  value={intervalSeconds}
                                  onChange={e => setIntervalSeconds(Math.max(60, parseInt(e.target.value) || 65))}
                                  min={60}
                                  className="w-32"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Mínimo 60s. Varia automaticamente para proteção anti-ban.
                                </p>
                              </div>
                              <Button
                                onClick={handleSend}
                                disabled={!selectedTemplate || !selectedList || listContactCount === 0}
                                className="w-full"
                                size="lg"
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Iniciar Disparo Automático ({listContactCount} contatos)
                              </Button>
                            </div>
                          )}

                          {/* Manual mode */}
                          {dispatchMode === "manual" && (
                            <>
                              {manualContacts.length === 0 ? (
                                <Button
                                  onClick={handleStartManual}
                                  disabled={!selectedTemplate || !selectedList || listContactCount === 0}
                                  className="w-full"
                                  size="lg"
                                >
                                  <Hand className="mr-2 h-4 w-4" />
                                  Iniciar Disparo Manual ({listContactCount} contatos)
                                </Button>
                              ) : (
                                <div className="space-y-3 rounded-lg border p-4">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm">Disparo Manual</h4>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {manualIndex}/{manualContacts.length}
                                      </Badge>
                                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={handleManualStop}>
                                        <X className="h-3.5 w-3.5 mr-1" /> Parar
                                      </Button>
                                    </div>
                                  </div>

                                  <Progress value={(manualIndex / manualContacts.length) * 100} className="h-2" />

                                  <div className="flex gap-3 text-xs text-muted-foreground">
                                    <span className="text-primary">{manualResults.sent} enviados</span>
                                    <span className="text-destructive">{manualResults.failed} falhas</span>
                                  </div>

                                  {manualFinished ? (
                                    <div className="text-center py-4 space-y-2">
                                      <CheckCircle className="h-8 w-8 mx-auto text-primary" />
                                      <p className="font-medium text-sm">Disparo manual concluído!</p>
                                      <p className="text-xs text-muted-foreground">
                                        {manualResults.sent} enviados, {manualResults.failed} falhas
                                      </p>
                                      <Button size="sm" variant="outline" onClick={handleManualStop}>Fechar</Button>
                                    </div>
                                  ) : currentManualContact ? (
                                    <div className="space-y-3">
                                      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                                        <p className="font-medium text-sm">{currentManualContact.name}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{currentManualContact.phone}</p>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={handleManualSendOne}
                                          disabled={manualSending}
                                          className="flex-1"
                                        >
                                          {manualSending ? <LoadingSpinner size="sm" /> : <Send className="mr-2 h-4 w-4" />}
                                          {manualSending ? "Enviando..." : "Enviar"}
                                        </Button>
                                        <Button
                                          onClick={handleManualSkip}
                                          disabled={manualSending}
                                          variant="outline"
                                        >
                                          <SkipForward className="mr-2 h-4 w-4" />
                                          Pular
                                        </Button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </>
                          )}

                          <div className="flex justify-start pt-2">
                            <Button variant="outline" onClick={() => setWizardStep(2)}>
                              <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                            </Button>
                          </div>
                        </motion.div>
                      )}
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
            <DialogDescription>
              {parsedContacts.length} contato(s) na lista "{listName}".
            </DialogDescription>
          </DialogHeader>

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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setParsedContacts(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={parsedContacts.length === 0}>
              <Upload className="mr-2 h-4 w-4" />
              Importar {parsedContacts.length} Contatos
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

      {/* View List Contacts Dialog */}
      <Dialog open={!!viewingList} onOpenChange={(open) => { if (!open) setViewingList(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lista: {viewingList}</DialogTitle>
            <DialogDescription>
              {viewingListContacts.length} contato(s) nesta lista
            </DialogDescription>
          </DialogHeader>
          {loadingListContacts ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" text="Carregando contatos..." />
            </div>
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
    </AppLayout>
  );
}
