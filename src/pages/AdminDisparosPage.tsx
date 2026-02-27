import { useState, useEffect } from "react";
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
import { Radio, Send, List, Layers } from "lucide-react";
import { toast } from "sonner";

const CONTACT_FIELD_OPTIONS = [
  { value: "name", label: "Nome do Cliente", defaultHint: "" },
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

export default function AdminDisparosPage() {
  const { users } = useAdmin();
  const { allTemplates, sendBulk, isSendingBulk } = useMetaTemplates();
  const { phones } = useWabaPhones();
  const { user } = useAuthContext();

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});

  // List-based selection
  const [selectedList, setSelectedList] = useState<string>("");
  const [availableLists, setAvailableLists] = useState<ContactList[]>([]);
  const [listContactCount, setListContactCount] = useState(0);
  const [loadingLists, setLoadingLists] = useState(false);

  // Batch mode
  const [batchMode, setBatchMode] = useState(false);
  const [batchSize, setBatchSize] = useState(50);

  // Auto-select phone
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedPhoneNumberId]);

  // Load available lists from admin pool contacts
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
        const lists = Object.entries(map).map(([name, count]) => ({ name, count }));
        setAvailableLists(lists);
        setLoadingLists(false);
      });
  }, []);

  // Update contact count when list changes
  useEffect(() => {
    if (!selectedList) { setListContactCount(0); return; }
    const found = availableLists.find((l) => l.name === selectedList);
    setListContactCount(found?.count || 0);
  }, [selectedList, availableLists]);

  // Auto-detect variables when template changes
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

  const handleSend = async () => {
    if (!selectedTemplate || !selectedList || !selectedUserId) return;
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }

    // Fetch contacts for the selected list
    const { data, error } = await (supabase as any)
      .from("contacts")
      .select("id")
      .is("user_id", null)
      .eq("contact_list", selectedList);

    if (error || !data || data.length === 0) {
      toast.error("Nenhum contato encontrado na lista selecionada");
      return;
    }

    let contactsToSend = (data as any[]).map((c) => c.id);

    // If batch mode, take only BATCH_SIZE
    if (batchMode) {
      contactsToSend = contactsToSend.slice(0, batchSize);
    }

    sendBulk(
      {
        contactIds: contactsToSend,
        templateName: selectedTemplate.name,
        templateLanguage: selectedTemplate.language,
        selectedPhoneNumberId: selectedPhoneNumberId || undefined,
        variableMappings,
        targetUserId: selectedUserId || undefined,
      },
      {
        onSuccess: async () => {
          // Contacts were already assigned to the operator by the edge function
          // (user_id set = removed from admin pool automatically)
          // Just refresh the lists to reflect the updated counts
          refreshLists();
        },
      }
    );
  };

  const refreshLists = () => {
    supabase
      .from("contacts")
      .select("*")
      .is("user_id", null)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        (data as any[]).forEach((c) => {
          const listName = c.contact_list;
          if (!listName) return;
          map[listName] = (map[listName] || 0) + 1;
        });
        const lists = Object.entries(map).map(([name, count]) => ({ name, count }));
        setAvailableLists(lists);
        // Update selected list count
        const found = lists.find((l) => l.name === selectedList);
        setListContactCount(found?.count || 0);
        if (found && found.count === 0) {
          setSelectedList("");
        }
      });
  };

  const templateBody = selectedTemplate ? getTemplateBody(selectedTemplate) : "";
  const templateVars = extractVariables(templateBody);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          Disparos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o template, a lista de contatos e dispare mensagens personalizadas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Step 1: Template */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              Template
            </CardTitle>
            <CardDescription>Template aprovado pela Meta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={selectedTemplate?.name || ""}
              onValueChange={(name) => {
                const t = approvedTemplates.find((t) => t.name === name);
                setSelectedTemplate(t || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o template..." />
              </SelectTrigger>
              <SelectContent>
                {approvedTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTemplate && templateBody && (
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {templateBody}
              </div>
            )}

            {templateVars.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Variáveis personalizadas</p>
                {templateVars.map((v) => {
                  const selectedField = CONTACT_FIELD_OPTIONS.find(opt => opt.value === variableMappings[String(v)]);
                  return (
                    <div key={v} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">{`{{${v}}}`}</Badge>
                        <Select
                          value={variableMappings[String(v)] || ""}
                          onValueChange={(val) => setVariableMappings((prev) => ({ ...prev, [String(v)]: val }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Campo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTACT_FIELD_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedField?.defaultHint && (
                        <p className="text-[10px] text-muted-foreground ml-14">{selectedField.defaultHint}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {phones.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Número de disparo</p>
                <PhoneNumberSelector
                  phones={phones}
                  selectedPhoneNumberId={selectedPhoneNumberId}
                  onSelect={setSelectedPhoneNumberId}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              Lista de Contatos
            </CardTitle>
            <CardDescription>
              {selectedList && listContactCount > 0
                ? batchMode
                  ? `${Math.min(batchSize, listContactCount)} de ${listContactCount} contato(s) serão disparados`
                  : `${listContactCount} contato(s) serão disparados`
                : "Selecione a lista de contatos"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingLists ? (
              <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
            ) : availableLists.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <List className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma lista disponível</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Importe contatos na aba Contatos</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {availableLists.map((list) => (
                  <button
                    key={list.name}
                    onClick={() => setSelectedList(list.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors text-left ${
                      selectedList === list.name
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium">{list.name}</span>
                    <Badge variant={selectedList === list.name ? "default" : "secondary"} className="text-xs">
                      {list.count} contatos
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            {/* Batch mode toggle */}
            <div className="rounded-lg border border-border p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="batch-mode" className="text-sm font-medium cursor-pointer">Modo lote</Label>
                    <p className="text-xs text-muted-foreground">Envia e remove da lista</p>
                  </div>
                </div>
                <Switch id="batch-mode" checked={batchMode} onCheckedChange={setBatchMode} />
              </div>
              {batchMode && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="batch-size" className="text-xs text-muted-foreground whitespace-nowrap">Quantidade:</Label>
                  <Input
                    id="batch-size"
                    type="number"
                    min={1}
                    max={listContactCount || 9999}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-8 w-24 text-sm"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Responsible + Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              Responsável pelas respostas
            </CardTitle>
            <CardDescription>Quem atenderá os clientes após o disparo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o operador..." />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter((u) => {
                    // Exclude current admin from operators list
                    return u.user_id !== user?.id;
                  })
                  .map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecione o operador que atenderá os clientes.
            </p>

            {/* Summary */}
            <div className="rounded-lg bg-muted p-3 space-y-1.5 mt-2">
              <p className="text-xs font-medium">Resumo do disparo</p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Template:</span>
                <span className="font-medium truncate max-w-[140px]">{selectedTemplate?.name || "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Lista:</span>
                <span className="font-medium truncate max-w-[140px]">{selectedList || "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Contatos:</span>
                <span className="font-medium">
                  {batchMode ? `${Math.min(batchSize, listContactCount)} de ${listContactCount}` : listContactCount}
                </span>
              </div>
              {batchMode && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Modo:</span>
                  <Badge variant="outline" className="text-xs">Lote de {batchSize}</Badge>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Responsável:</span>
                <span className="font-medium">
                  {users.find(u => u.user_id === selectedUserId)?.full_name || "—"}
                </span>
              </div>
            </div>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleSend}
              disabled={
                !selectedTemplate ||
                !selectedList ||
                !selectedUserId ||
                listContactCount === 0 ||
                isSendingBulk ||
                (phones.length > 0 && !selectedPhoneNumberId)
              }
            >
              {isSendingBulk ? (
                <><LoadingSpinner size="sm" /> Disparando...</>
              ) : (
                <><Send className="h-4 w-4" /> Disparar para {batchMode ? Math.min(batchSize, listContactCount) : listContactCount} contato{(batchMode ? Math.min(batchSize, listContactCount) : listContactCount) !== 1 ? "s" : ""}</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
