import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useMetaTemplates, MetaTemplate } from "@/hooks/useMetaTemplates";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneNumberSelector } from "@/components/chat/PhoneNumberSelector";
import { Radio, Users, Send, List } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CONTACT_FIELD_OPTIONS = [
  { value: "name", label: "Nome do Cliente" },
  { value: "phone", label: "Telefone" },
  { value: "lawyer_name", label: "Nome do Advogado" },
  { value: "process_number", label: "Número do Processo" },
  { value: "cpf", label: "CPF" },
  { value: "valor_da_causa", label: "Valor da Causa" },
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

export default function AdminDisparosPage() {
  const { users } = useAdmin();
  const { allTemplates, sendBulk, isSendingBulk } = useMetaTemplates();
  const { phones } = useWabaPhones();

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});

  // Contact source: "list" = admin pool lists, "user" = contacts already assigned to a user
  const [contactSource, setContactSource] = useState<"list" | "user">("list");
  const [selectedList, setSelectedList] = useState<string>("");
  const [availableLists, setAvailableLists] = useState<{ id: string; label: string; count: number }[]>([]);
  const [poolContacts, setPoolContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Auto-select phone
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedPhoneNumberId]);

  // Load available lists from admin pool
  useEffect(() => {
    supabase
      .from("contacts")
      .select("*")
      .is("user_id", null)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        (data as any[]).forEach((c) => {
          const key = c.contact_list || "__sem_lista__";
          map[key] = (map[key] || 0) + 1;
        });
        const lists = Object.entries(map).map(([id, count]) => ({
          id,
          label: id === "__sem_lista__" ? "Sem lista" : id,
          count,
        }));
        setAvailableLists(lists);
        if (lists.length > 0 && !selectedList) {
          setSelectedList(lists[0].id);
        }
      });
  }, []);

  // Load contacts when source/list/user changes
  useEffect(() => {
    setSelectedContacts([]);
    if (contactSource === "list") {
      if (!selectedList) { setPoolContacts([]); return; }
      setLoadingContacts(true);
      // Fetch all admin pool contacts then filter by list client-side to avoid TS type issues
      supabase
        .from("contacts")
        .select("*")
        .is("user_id", null)
        .order("name")
        .then(({ data }) => {
          const filtered = (data || []).filter((c: any) => {
            const cl = c.contact_list || "__sem_lista__";
            return cl === selectedList;
          });
          setPoolContacts(filtered);
          setLoadingContacts(false);
        });
    } else {
      if (!selectedUserId) { setPoolContacts([]); return; }
      setLoadingContacts(true);
      supabase
        .from("contacts")
        .select("*")
        .eq("user_id", selectedUserId)
        .order("name")
        .then(({ data }) => {
          setPoolContacts(data || []);
          setLoadingContacts(false);
        });
    }
  }, [contactSource, selectedList, selectedUserId]);

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

  const handleToggleContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === poolContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(poolContacts.map((c) => c.id));
    }
  };

  const handleSend = () => {
    if (!selectedTemplate || selectedContacts.length === 0) return;
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }
    sendBulk({
      contactIds: selectedContacts,
      templateName: selectedTemplate.name,
      templateLanguage: selectedTemplate.language,
      selectedPhoneNumberId: selectedPhoneNumberId || undefined,
      variableMappings,
      targetUserId: selectedUserId || undefined,
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
          Selecione o template, os contatos e dispare mensagens personalizadas.
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
                {templateVars.map((v) => (
                  <div key={v} className="flex items-center gap-2">
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
                ))}
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

        {/* Step 2: Contacts */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              Contatos
            </CardTitle>
            <CardDescription>
              {selectedContacts.length > 0
                ? `${selectedContacts.length} de ${poolContacts.length} selecionados`
                : "Selecione a origem dos contatos"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 space-y-3">
            {/* Source selector */}
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <button
                onClick={() => setContactSource("list")}
                className={cn("flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-colors", contactSource === "list" ? "bg-background shadow text-foreground font-medium" : "text-muted-foreground")}
              >
                <List className="h-3 w-3" /> Lista admin
              </button>
              <button
                onClick={() => setContactSource("user")}
                className={cn("flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-colors", contactSource === "user" ? "bg-background shadow text-foreground font-medium" : "text-muted-foreground")}
              >
                <Users className="h-3 w-3" /> Por usuário
              </button>
            </div>

            {/* List or user selector */}
            {contactSource === "list" ? (
              <Select value={selectedList} onValueChange={setSelectedList}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione a lista..." />
                </SelectTrigger>
                <SelectContent>
                  {availableLists.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="text-xs">
                      {l.label} <span className="text-muted-foreground">({l.count})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione o usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id} className="text-xs">
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Contacts list */}
            {loadingContacts ? (
              <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
            ) : poolContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {contactSource === "list" ? "Selecione uma lista" : "Selecione o usuário"}
              </p>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleSelectAll} className="w-full">
                  {selectedContacts.length === poolContacts.length ? "Desmarcar todos" : `Selecionar todos (${poolContacts.length})`}
                </Button>
                <ScrollArea className="flex-1 max-h-52">
                  <div className="space-y-1">
                    {poolContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors",
                          selectedContacts.includes(contact.id) && "bg-primary/5 border-primary/30"
                        )}
                        onClick={() => handleToggleContact(contact.id)}
                      >
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={() => handleToggleContact(contact.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>

        {/* Step 3: User responsible (optional) */}
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
                <SelectValue placeholder="Selecione o usuário..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__admin__">Administrador</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se nenhum usuário for selecionado, o contato ficará sem responsável.
            </p>

            {/* Summary */}
            <div className="rounded-lg bg-muted p-3 space-y-1.5 mt-2">
              <p className="text-xs font-medium">Resumo do disparo</p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Template:</span>
                <span className="font-medium">{selectedTemplate?.name || "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Contatos:</span>
                <span className="font-medium">{selectedContacts.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Responsável:</span>
                <span className="font-medium">
                  {selectedUserId === "__admin__" ? "Administrador" : users.find(u => u.user_id === selectedUserId)?.full_name || "—"}
                </span>
              </div>
            </div>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleSend}
              disabled={
                !selectedTemplate ||
                selectedContacts.length === 0 ||
                isSendingBulk ||
                (phones.length > 0 && !selectedPhoneNumberId)
              }
            >
              {isSendingBulk ? (
                <><LoadingSpinner size="sm" /> Disparando...</>
              ) : (
                <><Send className="h-4 w-4" /> Disparar para {selectedContacts.length} contato{selectedContacts.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
