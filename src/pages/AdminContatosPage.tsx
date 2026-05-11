import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parseJuridicalList } from "@/lib/parseJuridicalList";
import { getStateFromPhone } from "@/lib/dddToState";
import { ParsedContact } from "@/types/juriszap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Switch } from "@/components/ui/switch";
import {
  Upload, UserPlus, File, Plus, User, Phone, Scale,
  CheckCircle, Search, Trash2, ContactRound, List, AlertTriangle,
  FileSpreadsheet, ShieldCheck, XCircle, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ContactList {
  name: string;
  count: number;
}

interface WhatsAppValidationEntry {
  phone: string;
  exists: boolean;
  status?: "has_whatsapp" | "no_whatsapp" | "unknown" | "invalid_format";
  reason?: string;
}

// Normalize phone to digits only, ensure 55 prefix
function normalizePhoneForMatch(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits.startsWith("55") && digits.length <= 11) {
    digits = "55" + digits;
  }
  return digits;
}

export default function AdminContatosPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const whatsappFileRef = useRef<HTMLInputElement>(null);
  const whatsappFileExistingRef = useRef<HTMLInputElement>(null);

  // List management
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [localLists, setLocalLists] = useState<string[]>([]);

  // Import state
  const [rawText, setRawText] = useState("");
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [splitByState, setSplitByState] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // WhatsApp validation (inside preview, before import)
  const [whatsappEntries, setWhatsappEntries] = useState<WhatsAppValidationEntry[]>([]);
  const [filterRendaMinValue, setFilterRendaMinValue] = useState(0);
  const [isValidatingWaApi, setIsValidatingWaApi] = useState(false);
  const [waApiProgress, setWaApiProgress] = useState({ done: 0, total: 0 });

  const handleValidateWhatsAppApi = async () => {
    if (parsedContacts.length === 0) return;
    setIsValidatingWaApi(true);
    setWaApiProgress({ done: 0, total: parsedContacts.length });
    const entries: WhatsAppValidationEntry[] = [];
    const BATCH = 25;
    try {
      for (let i = 0; i < parsedContacts.length; i += BATCH) {
        const batch = parsedContacts.slice(i, i + BATCH);
        const phones = batch.map((c) => normalizePhoneForMatch(String(c.phone || "")));
        const { data, error } = await supabase.functions.invoke("check-whatsapp-existence", {
          body: { phones },
        });
        if (error) throw error;
        const statuses: Record<string, { exists: boolean | null; status: WhatsAppValidationEntry["status"]; reason?: string }> = data?.statuses || {};
        const results: Record<string, boolean> = data?.results || {};
        for (const p of phones) {
          const details = statuses[p];
          entries.push({
            phone: p,
            exists: details ? details.status === "has_whatsapp" : results[p] === true,
            status: details?.status || (results[p] === true ? "has_whatsapp" : "unknown"),
            reason: details?.reason,
          });
        }
        setWaApiProgress({ done: Math.min(i + BATCH, parsedContacts.length), total: parsedContacts.length });
      }
      setWhatsappEntries(entries);
      const valid = entries.filter((e) => e.exists).length;
      const unknown = entries.filter((e) => e.status === "unknown").length;
      toast.success(`Validação concluída: ${valid}/${entries.length} confirmados${unknown ? `, ${unknown} inconclusivos` : ""}`);
    } catch (err: any) {
      toast.error("Erro na validação", { description: err.message });
    } finally {
      setIsValidatingWaApi(false);
    }
  };

  // WhatsApp validation for existing list
  const [showExistingValidation, setShowExistingValidation] = useState(false);
  const [existingWhatsappEntries, setExistingWhatsappEntries] = useState<WhatsAppValidationEntry[]>([]);
  const [existingFilterRenda, setExistingFilterRenda] = useState(false);
  const [isProcessingExistingValidation, setIsProcessingExistingValidation] = useState(false);

  // Single contact state
  const [singleName, setSingleName] = useState("");
  const [singlePhone, setSinglePhone] = useState("");
  const [singleLawyer, setSingleLawyer] = useState("");
  const [singleProcess, setSingleProcess] = useState("");

  // Search
  const [search, setSearch] = useState("");

  // Fetch all admin pool contacts (user_id is null)
  const { data: allContacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["admin-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .is("user_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Derive lists
  const lists: ContactList[] = (() => {
    const map: Record<string, number> = {};
    localLists.forEach((name) => { map[name] = 0; });
    (allContacts as any[]).forEach((c) => {
      const listName = c.contact_list;
      if (!listName) return;
      map[listName] = (map[listName] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  })();

  const displayedContacts = selectedList
    ? (allContacts as any[]).filter((c) => {
        if (!search) return c.contact_list === selectedList;
        return (
          c.contact_list === selectedList &&
          (c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
        );
      })
    : [];

  // --- Compute validated contacts for preview ---
  const validatedContacts = (() => {
    if (whatsappEntries.length === 0) return parsedContacts;

    const validPhones = new Set(
      whatsappEntries.filter(e => e.exists).map(e => e.phone)
    );

    let filtered = parsedContacts.filter(c => {
      const normalized = normalizePhoneForMatch(c.phone);
      return validPhones.has(normalized);
    });

    if (filterRendaMinValue > 0) {
      filtered = filtered.filter(c => {
        const renda = c.renda ?? 0;
        // Se renda não foi informada (0), mantém o contato; se informada e abaixo do mínimo, remove
        return renda === 0 || renda >= filterRendaMinValue;
      });
    }

    return filtered;
  })();

  const removedCount = parsedContacts.length - validatedContacts.length;
  const noWhatsappPhoneCount = whatsappEntries.filter(e => e.status === "no_whatsapp" || e.status === "invalid_format").length;
  const unknownPhoneCount = whatsappEntries.filter(e => e.status === "unknown").length;
  const validPhoneCount = whatsappEntries.filter(e => e.exists).length;

  // --- Mutations ---

  const addContactMutation = useMutation({
    mutationFn: async (contact: { name: string; phone: string; lawyer_name?: string; process_number?: string; contact_list: string }) => {
      const { error } = await supabase.from("contacts").insert({
        name: contact.name,
        phone: contact.phone,
        lawyer_name: contact.lawyer_name,
        process_number: contact.process_number,
        contact_list: contact.contact_list,
        status: "novo",
        user_id: null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato adicionado!");
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
      setSingleName(""); setSinglePhone(""); setSingleLawyer(""); setSingleProcess("");
    },
    onError: (e: any) => toast.error("Erro ao adicionar contato", { description: e.message }),
  });

  const importContactsMutation = useMutation({
    mutationFn: async ({ contacts, listName, splitByState }: { contacts: ParsedContact[]; listName: string; splitByState: boolean }) => {
      let ok = 0; let fail = 0;
      const createdLists = new Set<string>();
      const total = contacts.length;
      setImportProgress(0);

      for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];
        let targetList = listName;
        if (splitByState) {
          const state = getStateFromPhone(c.phone);
          targetList = `${listName} - ${state}`;
        }
        createdLists.add(targetList);

        const { error } = await supabase.from("contacts").insert({
          name: c.name,
          phone: c.phone,
          lawyer_name: c.lawyer_name,
          process_number: c.process_number,
          cpf: (c as any).cpf || null,
          contact_list: targetList,
          status: "novo",
          user_id: null,
          has_whatsapp: whatsappEntries.length > 0 ? true : null,
        } as any);
        if (error) fail++; else ok++;
        setImportProgress(Math.round(((i + 1) / total) * 100));
      }
      await supabase.from("import_logs").insert({ total_contacts: contacts.length, successful: ok, failed: fail });
      return { ok, fail, listsCreated: createdLists.size, totalOriginal: parsedContacts.length, removed: parsedContacts.length - contacts.length };
    },
    onSuccess: ({ ok, fail, listsCreated, totalOriginal, removed }) => {
      const listMsg = listsCreated > 1 ? ` em ${listsCreated} listas por estado` : "";
      const removedMsg = removed > 0 ? ` | ${removed} contato(s) excluídos de ${totalOriginal} clientes` : "";
      toast.success(
        `✅ Importação concluída: ${ok} cliente(s) importados${listMsg}${removedMsg}`,
        {
          style: { background: "#16a34a", color: "#fff", border: "1px solid #16a34a" },
          duration: 8000,
        }
      );
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
      setRawText(""); setParsedContacts([]); setParseErrors([]); setShowPreview(false);
      setSplitByState(false); setWhatsappEntries([]); setFilterRendaMinValue(0);
    },
    onError: (e: any) => toast.error("Erro na importação", { description: e.message }),
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato removido");
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
    },
    onError: (e: any) => toast.error("Erro ao remover", { description: e.message }),
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listName: string) => {
      const ids = (allContacts as any[])
        .filter((c) => c.contact_list === listName)
        .map((c) => c.id);
      if (ids.length === 0) return;

      const batchSize = 100;
      // Delete related messages and conversations first (foreign keys)
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await supabase.from("messages").delete().in("contact_id", batch);
        await supabase.from("conversations").delete().in("contact_id", batch);
      }
      // Then delete contacts in batches
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { error } = await supabase.from("contacts").delete().in("id", batch);
        if (error) throw error;
      }
    },
    onSuccess: (_, listName) => {
      toast.success("Lista excluída com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
      setLocalLists((prev) => prev.filter((l) => l !== listName));
      setSelectedList(null);
      setListToDelete(null);
    },
    onError: (e: any) => toast.error("Erro ao excluir lista", { description: e.message }),
  });

  // --- Handlers ---

  const handleParse = () => {
    const { contacts, errors } = parseJuridicalList(rawText);
    setParsedContacts(contacts);
    setParseErrors(errors);
    setWhatsappEntries([]);
    setFilterRendaMinValue(0);
    if (contacts.length > 0) setShowPreview(true);
    else toast.warning("Nenhum contato encontrado");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".txt")) { toast.error("Apenas arquivos .txt"); return; }
    setIsLoadingFile(true);
    try {
      const text = await file.text();
      setRawText(text);
      const { contacts, errors } = parseJuridicalList(text);
      setParsedContacts(contacts);
      setParseErrors(errors);
      setWhatsappEntries([]);
      setFilterRendaMinValue(0);
      if (contacts.length > 0) { setShowPreview(true); toast.success(`${contacts.length} contato(s) encontrado(s)`); }
      else toast.warning("Nenhum contato encontrado");
    } catch { toast.error("Erro ao ler arquivo"); }
    finally { setIsLoadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleAddSingle = () => {
    if (!singleName.trim() || !singlePhone.trim() || !selectedList) return;
    let phone = singlePhone.replace(/\D/g, "");
    if (phone.length === 11) phone = "55" + phone;
    else if (phone.length === 10) phone = "55" + phone.slice(0, 2) + "9" + phone.slice(2);
    else if (!phone.startsWith("55")) phone = "55" + phone;

    addContactMutation.mutate({
      name: singleName.trim(),
      phone,
      lawyer_name: singleLawyer.trim() || undefined,
      process_number: singleProcess.trim() || undefined,
      contact_list: selectedList,
    });
  };

  const handleCreateList = () => {
    const name = newListName.trim();
    if (!name) return;
    setLocalLists((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setSelectedList(name);
    setNewListName("");
    setShowNewList(false);
  };

  // Parse WhatsApp validation Excel (for pre-import)
  const parseWhatsAppExcel = async (file: File): Promise<WhatsAppValidationEntry[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    const entries: WhatsAppValidationEntry[] = [];

    for (const row of rows) {
      const phoneKey = Object.keys(row).find(k =>
        k.toLowerCase().includes("number") || k.toLowerCase().includes("whatsapp") || k.toLowerCase().includes("telefone") || k.toLowerCase().includes("phone")
      );
      const existsKey = Object.keys(row).find(k =>
        k.toLowerCase().includes("exist") || k.toLowerCase().includes("valid") || k.toLowerCase().includes("status")
      );

      if (phoneKey && existsKey) {
        const phone = normalizePhoneForMatch(String(row[phoneKey]));
        const existsVal = String(row[existsKey]).toLowerCase().trim();
        const exists = existsVal === "yes" || existsVal === "sim" || existsVal === "true" || existsVal === "1";
        entries.push({ phone, exists });
      }
    }

    return entries;
  };

  const handleWhatsAppFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const entries = await parseWhatsAppExcel(file);
      if (entries.length === 0) {
        toast.error("Nenhum número encontrado no arquivo. Verifique o formato.");
        return;
      }
      setWhatsappEntries(entries);
      toast.success(`${entries.length} número(s) lidos do arquivo`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao ler o arquivo Excel");
    } finally {
      if (whatsappFileRef.current) whatsappFileRef.current.value = "";
    }
  };

  // Handle import - uses validatedContacts (already filtered)
  const handleConfirmImport = () => {
    if (!selectedList) return;
    const hasApiValidation = whatsappEntries.some((entry) => entry.status === "has_whatsapp" || entry.status === "no_whatsapp" || entry.status === "unknown" || entry.status === "invalid_format");
    if (!hasApiValidation) {
      toast.error("Valide os números via API antes de importar");
      return;
    }
    importContactsMutation.mutate({ contacts: validatedContacts, listName: selectedList, splitByState });
  };

  // --- Existing list validation ---
  const handleExistingWhatsAppUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const entries = await parseWhatsAppExcel(file);
      if (entries.length === 0) {
        toast.error("Nenhum número encontrado no arquivo.");
        return;
      }
      setExistingWhatsappEntries(entries);
      toast.success(`${entries.length} número(s) lidos`);
    } catch {
      toast.error("Erro ao ler o arquivo Excel");
    } finally {
      if (whatsappFileExistingRef.current) whatsappFileExistingRef.current.value = "";
    }
  };

  const handleApplyExistingValidation = async () => {
    if (!selectedList || existingWhatsappEntries.length === 0) return;
    setIsProcessingExistingValidation(true);

    try {
      const { data: freshContacts, error: fetchErr } = await supabase
        .from("contacts")
        .select("*")
        .is("user_id", null)
        .eq("contact_list", selectedList);

      if (fetchErr) throw fetchErr;
      const contacts = freshContacts || [];

      const invalidPhones = new Set(existingWhatsappEntries.filter(e => !e.exists).map(e => e.phone));
      const validPhones = new Set(existingWhatsappEntries.filter(e => e.exists).map(e => e.phone));

      const toRemoveIds: string[] = [];
      const toMarkValidIds: string[] = [];

      for (const contact of contacts) {
        const normalized = normalizePhoneForMatch(contact.phone);
        if (invalidPhones.has(normalized)) {
          toRemoveIds.push(contact.id);
        } else if (validPhones.has(normalized)) {
          toMarkValidIds.push(contact.id);
        }
      }

      if (existingFilterRenda) {
        for (const contact of contacts) {
          if (!toRemoveIds.includes(contact.id)) {
            const renda = parseFloat(String(contact.valor_da_causa ?? "0")) || 0;
            if (renda < 2000 && renda > 0) {
              toRemoveIds.push(contact.id);
            }
          }
        }
      }

      if (toRemoveIds.length > 0) {
        for (let i = 0; i < toRemoveIds.length; i += 100) {
          const batch = toRemoveIds.slice(i, i + 100);
          await supabase.from("contacts").delete().in("id", batch);
        }
      }

      if (toMarkValidIds.length > 0) {
        for (let i = 0; i < toMarkValidIds.length; i += 100) {
          const batch = toMarkValidIds.slice(i, i + 100);
          await supabase.from("contacts").update({ has_whatsapp: true } as any).in("id", batch);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });

      toast.success(
        `✅ Validação concluída! ${toRemoveIds.length} contato(s) excluídos de ${contacts.length} clientes. ${toMarkValidIds.length} confirmados com WhatsApp.`,
        {
          style: { background: "#16a34a", color: "#fff", border: "1px solid #16a34a" },
          duration: 8000,
        }
      );

      setShowExistingValidation(false);
      setExistingWhatsappEntries([]);
      setExistingFilterRenda(false);
    } catch (err: any) {
      toast.error("Erro ao aplicar validação", { description: err.message });
    } finally {
      setIsProcessingExistingValidation(false);
    }
  };

  const existingValidCount = existingWhatsappEntries.filter(e => e.exists).length;
  const existingInvalidCount = existingWhatsappEntries.filter(e => !e.exists).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ContactRound className="h-5 w-5 text-primary" />
          Contatos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os contatos por lista para uso nos disparos.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Left: Lists sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-1.5">
              <List className="h-4 w-4" /> Listas
            </CardTitle>
            <CardDescription>Grupos de contatos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {lists.length === 0 && !showNewList && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhuma lista criada</p>
            )}
            {lists.map((list) => (
              <div
                key={list.name}
                className={`group w-full flex justify-between items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${selectedList === list.name ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                onClick={() => setSelectedList(list.name)}
              >
                <span className="truncate font-medium">{list.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="secondary" className="text-xs">{list.count}</Badge>
                  <button
                    onClick={(e) => { e.stopPropagation(); setListToDelete(list.name); }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-destructive ${selectedList === list.name ? "text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}

            {showNewList ? (
              <div className="pt-2 space-y-1">
                <Input
                  placeholder="Nome da lista..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateList(); }}
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleCreateList}>Criar</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewList(false)}>✕</Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 mt-1" onClick={() => setShowNewList(true)}>
                <Plus className="h-3 w-3" /> Nova lista
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Right: Contacts + Add */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedList ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <List className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="font-medium text-muted-foreground">Selecione ou crie uma lista</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Escolha uma lista na barra lateral ou crie uma nova para começar.
                </p>
                <Button variant="outline" className="mt-4 gap-1.5" onClick={() => setShowNewList(true)}>
                  <Plus className="h-4 w-4" /> Nova lista
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Add contacts */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Adicionar Contatos</CardTitle>
                  <CardDescription>
                    Adicionando à lista: <span className="font-semibold text-foreground">{selectedList}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="individual">
                    <TabsList className="w-full">
                      <TabsTrigger value="individual" className="flex-1 gap-1.5">
                        <UserPlus className="h-3.5 w-3.5" /> Individual
                      </TabsTrigger>
                      <TabsTrigger value="lista" className="flex-1 gap-1.5">
                        <Upload className="h-3.5 w-3.5" /> Importar Lista
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="individual" className="mt-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
                          <div className="relative">
                            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Ex: Maria Santos" value={singleName} onChange={(e) => setSingleName(e.target.value)} className="pl-8 h-9 text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Telefone <span className="text-destructive">*</span></Label>
                          <div className="relative">
                            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="(11) 99999-8888" value={singlePhone} onChange={(e) => setSinglePhone(e.target.value)} className="pl-8 h-9 text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Parte Contrária</Label>
                          <div className="relative">
                            <Scale className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Dr. João Silva" value={singleLawyer} onChange={(e) => setSingleLawyer(e.target.value)} className="pl-8 h-9 text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Processo</Label>
                          <Input placeholder="1234567-89.2024.8.26.0100" value={singleProcess} onChange={(e) => setSingleProcess(e.target.value)} className="h-9 text-sm" />
                        </div>
                      </div>
                      <Button
                        className="w-full mt-3"
                        onClick={handleAddSingle}
                        disabled={!singleName.trim() || !singlePhone.trim() || addContactMutation.isPending}
                      >
                        {addContactMutation.isPending ? <LoadingSpinner size="sm" /> : <><Plus className="h-4 w-4 mr-1.5" /> Adicionar Contato</>}
                      </Button>
                    </TabsContent>

                    <TabsContent value="lista" className="mt-4 space-y-3">
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt" className="hidden" />
                      <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isLoadingFile}>
                        {isLoadingFile ? <LoadingSpinner size="sm" /> : <><File className="h-4 w-4 mr-1.5" /> Carregar Arquivo .txt</>}
                      </Button>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">ou cole o texto</span>
                        </div>
                      </div>
                      <Textarea
                        placeholder="Cole aqui a lista no formato jurídico com separadores ================"
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        className="min-h-[120px] font-mono text-xs"
                      />
                      <Button className="w-full" onClick={handleParse} disabled={!rawText.trim()}>
                        <Upload className="h-4 w-4 mr-1.5" /> Processar Lista
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Validate WhatsApp button for existing list */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setExistingWhatsappEntries([]);
                  setExistingFilterRenda(false);
                  setShowExistingValidation(true);
                }}
              >
                <ShieldCheck className="h-4 w-4" />
                Validar WhatsApp desta lista (upload Excel)
              </Button>

              {/* Contacts table */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{selectedList}</CardTitle>
                      <CardDescription>{displayedContacts.length} contato(s)</CardDescription>
                    </div>
                    <div className="relative w-48">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingContacts ? (
                    <div className="flex justify-center py-8"><LoadingSpinner /></div>
                  ) : displayedContacts.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                      <ContactRound className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">Nenhum contato nesta lista</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead className="hidden md:table-cell">Parte Contrária</TableHead>
                            <TableHead className="hidden lg:table-cell">Processo</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedContacts.map((c: any) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium text-sm">{c.name}</TableCell>
                              <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{c.lawyer_name || "-"}</TableCell>
                              <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{c.process_number || "-"}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteContactMutation.mutate(c.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Import Preview Dialog - WITH validation step before confirming */}
      <Dialog open={showPreview} onOpenChange={(open) => {
        if (!open) {
          setShowPreview(false);
          setWhatsappEntries([]);
           setFilterRendaMinValue(0);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar Importação</DialogTitle>
            <DialogDescription>
              {parsedContacts.length} contato(s) encontrado(s).
              {selectedList && <> Serão adicionados à lista <strong>{selectedList}</strong>.</>}
            </DialogDescription>
          </DialogHeader>

          {parseErrors.length > 0 && (
            <AlertBanner type="warning" title="Avisos">
              <ul className="list-inside list-disc text-xs">
                {parseErrors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </AlertBanner>
          )}

          {/* Step 1: WhatsApp Validation Upload */}
          <div className="rounded-lg border-2 border-dashed border-primary/30 p-4 space-y-3 bg-primary/5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">Etapa 1: Validação WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  Faça upload do Excel com a validação dos números para filtrar antes de importar.
                </p>
              </div>
            </div>

            <input
              type="file"
              ref={whatsappFileRef}
              onChange={handleWhatsAppFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => whatsappFileRef.current?.click()}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {whatsappEntries.length > 0 ? "Trocar arquivo Excel" : "Carregar arquivo de validação (.xlsx)"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Formato esperado: colunas "WhatsApp Number" e "Does it exist?" (Yes/No)
            </p>

            {/* Validação via API rápida */}
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Validar via API (rápido)</p>
                  <p className="text-xs text-muted-foreground">
                    Verifica online quais números têm WhatsApp — sem precisar de Excel.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleValidateWhatsAppApi}
                disabled={parsedContacts.length === 0 || isValidatingWaApi}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isValidatingWaApi ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">{waApiProgress.done}/{waApiProgress.total}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Validar agora
                  </>
                )}
              </Button>
            </div>

            {/* Validation results */}
            {whatsappEntries.length > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Card className="p-3 text-center">
                    <p className="text-xl font-bold">{whatsappEntries.length}</p>
                    <p className="text-[10px] text-muted-foreground">Verificados</p>
                  </Card>
                  <Card className="p-3 text-center border-green-500/30">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      <p className="text-xl font-bold text-green-500">{validPhoneCount}</p>
                    </div>
                      <p className="text-[10px] text-muted-foreground">Confirmados</p>
                  </Card>
                    <Card className="p-3 text-center border-warning/30">
                      <div className="flex items-center justify-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        <p className="text-xl font-bold text-warning">{unknownPhoneCount}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Inconclusivos</p>
                    </Card>
                  <Card className="p-3 text-center border-destructive/30">
                    <div className="flex items-center justify-center gap-1">
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                        <p className="text-xl font-bold text-destructive">{noWhatsappPhoneCount}</p>
                    </div>
                      <p className="text-[10px] text-muted-foreground">Sem WhatsApp</p>
                  </Card>
                </div>

                {/* Renda filter */}
                <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Filtrar por renda mínima</p>
                      <p className="text-xs text-muted-foreground">Remove clientes com valor da causa abaixo do limite</p>
                    </div>
                  </div>
                  <select
                    value={filterRendaMinValue}
                    onChange={(e) => setFilterRendaMinValue(Number(e.target.value))}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value={0}>Desligado</option>
                    <option value={2000}>R$ 2.000+</option>
                    <option value={5000}>R$ 5.000+</option>
                    <option value={10000}>R$ 10.000+</option>
                    <option value={20000}>R$ 20.000+</option>
                  </select>
                </div>

                {/* Summary */}
                <AlertBanner type={removedCount > 0 ? "warning" : "info"} title="Resultado do filtro">
                  <p className="text-xs">
                    <strong>{validatedContacts.length}</strong> cliente(s) serão importados.
                    {removedCount > 0 && <> <strong className="text-destructive">{removedCount}</strong> cliente(s) serão removidos (sem WhatsApp confirmado, inconclusivo{filterRendaMinValue > 0 ? ` ou renda < R$${filterRendaMinValue.toLocaleString("pt-BR")}` : ""}).</>}
                  </p>
                </AlertBanner>
              </div>
            )}
          </div>

          {/* Step 2: Split by state toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Separar por estado (DDD)</p>
              <p className="text-xs text-muted-foreground">
                Cria listas automáticas por UF com base no DDD dos telefones
              </p>
            </div>
            <Switch checked={splitByState} onCheckedChange={setSplitByState} />
          </div>

          {splitByState && validatedContacts.length > 0 && (() => {
            const stateGroups: Record<string, number> = {};
            validatedContacts.forEach(c => {
              const state = getStateFromPhone(c.phone);
              const listName = `${selectedList} - ${state}`;
              stateGroups[listName] = (stateGroups[listName] || 0) + 1;
            });
            return (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">Listas que serão criadas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(stateGroups).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                    <Badge key={name} variant="secondary" className="text-xs">
                      {name} ({count})
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Step 3: Preview table - shows only validated contacts */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {whatsappEntries.length > 0 ? `Clientes que serão importados (${validatedContacts.length}):` : `Todos os contatos (${parsedContacts.length}):`}
            </p>
            <ScrollArea className="max-h-52">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    {splitByState && <TableHead>Estado</TableHead>}
                    <TableHead>Parte Contrária</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(whatsappEntries.length > 0 ? validatedContacts : parsedContacts).slice(0, 50).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                      {splitByState && <TableCell><Badge variant="outline" className="text-[10px]">{getStateFromPhone(c.phone)}</Badge></TableCell>}
                      <TableCell className="text-xs">{c.lawyer_name || "-"}</TableCell>
                      <TableCell className="text-xs">{c.process_number || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => setParsedContacts(prev => prev.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(whatsappEntries.length > 0 ? validatedContacts : parsedContacts).length > 50 && (
                    <TableRow><TableCell colSpan={splitByState ? 6 : 5} className="text-center text-xs text-muted-foreground">... e mais {(whatsappEntries.length > 0 ? validatedContacts : parsedContacts).length - 50} contatos</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {importContactsMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Importando contatos...</span>
                <span className="font-semibold text-primary">{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="h-3" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPreview(false); setWhatsappEntries([]); setFilterRendaMinValue(0); }} disabled={importContactsMutation.isPending}>Cancelar</Button>
            <Button
              onClick={handleConfirmImport}
              disabled={importContactsMutation.isPending || !selectedList || validatedContacts.length === 0}
            >
              {importContactsMutation.isPending ? <LoadingSpinner size="sm" /> : (
                <>
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Importar {validatedContacts.length} cliente(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing List WhatsApp Validation Dialog */}
      <Dialog open={showExistingValidation} onOpenChange={(open) => {
        if (!open) {
          setShowExistingValidation(false);
          setExistingWhatsappEntries([]);
          setExistingFilterRenda(false);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Validação WhatsApp
            </DialogTitle>
            <DialogDescription>
              Faça upload do arquivo Excel para remover números inválidos da lista <strong>{selectedList}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input
              type="file"
              ref={whatsappFileExistingRef}
              onChange={handleExistingWhatsAppUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => whatsappFileExistingRef.current?.click()}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {existingWhatsappEntries.length > 0 ? "Trocar arquivo Excel" : "Carregar arquivo Excel (.xlsx)"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Formato esperado: colunas "WhatsApp Number" e "Does it exist?" (Yes/No)
            </p>

            {existingWhatsappEntries.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Card className="p-3 text-center">
                    <p className="text-xl font-bold">{existingWhatsappEntries.length}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </Card>
                  <Card className="p-3 text-center border-green-500/30">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      <p className="text-xl font-bold text-green-500">{existingValidCount}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Válidos</p>
                  </Card>
                  <Card className="p-3 text-center border-destructive/30">
                    <div className="flex items-center justify-center gap-1">
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                      <p className="text-xl font-bold text-destructive">{existingInvalidCount}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Inválidos</p>
                  </Card>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Filtrar renda acima de R$2.000</p>
                      <p className="text-xs text-muted-foreground">Remove clientes com valor da causa abaixo de R$2.000</p>
                    </div>
                  </div>
                  <Switch checked={existingFilterRenda} onCheckedChange={setExistingFilterRenda} />
                </div>

                <ScrollArea className="max-h-40 rounded-md border">
                  <div className="p-2 space-y-0.5">
                    {existingWhatsappEntries.slice(0, 30).map((entry, i) => (
                      <div key={i} className="flex items-center justify-between py-1 px-2 rounded text-xs hover:bg-muted/50">
                        <span className="font-mono">{entry.phone}</span>
                        {entry.exists ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Yes</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">No</Badge>
                        )}
                      </div>
                    ))}
                    {existingWhatsappEntries.length > 30 && (
                      <p className="text-center text-[10px] text-muted-foreground py-1">
                        ... e mais {existingWhatsappEntries.length - 30} números
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => { setShowExistingValidation(false); setExistingWhatsappEntries([]); setExistingFilterRenda(false); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleApplyExistingValidation}
              disabled={existingWhatsappEntries.length === 0 || isProcessingExistingValidation}
              className="gap-1.5"
            >
              {isProcessingExistingValidation ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Aplicar Validação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete List Confirm Dialog */}
      <Dialog open={!!listToDelete} onOpenChange={(open) => !open && setListToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir lista "{listToDelete}"?
            </DialogTitle>
            <DialogDescription>
              Esta ação irá excluir permanentemente todos os contatos dentro desta lista.
              {listToDelete && (() => {
                const count = lists.find(l => l.name === listToDelete)?.count || 0;
                return count > 0 ? <strong className="block mt-1"> {count} contato(s) serão removidos.</strong> : null;
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListToDelete(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => listToDelete && deleteListMutation.mutate(listToDelete)}
              disabled={deleteListMutation.isPending}
            >
              {deleteListMutation.isPending ? <LoadingSpinner size="sm" /> : <><Trash2 className="h-4 w-4 mr-1.5" /> Excluir lista</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
