import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useMetaTemplates, MetaTemplate } from "@/hooks/useMetaTemplates";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { useContacts } from "@/hooks/useContacts";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Profile } from "@/types/juriszap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneNumberSelector } from "@/components/chat/PhoneNumberSelector";
import { Radio, Users, FileText, Send, ChevronRight } from "lucide-react";
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
  const { user } = useAuthContext();

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});
  const [userContacts, setUserContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Auto-select phone
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedPhoneNumberId]);

  // Load contacts when user is selected
  useEffect(() => {
    if (!selectedUserId) { setUserContacts([]); return; }
    setLoadingContacts(true);
    supabase
      .from("contacts")
      .select("*")
      .eq("user_id", selectedUserId)
      .order("name")
      .then(({ data }) => {
        setUserContacts(data || []);
        setSelectedContacts([]);
        setLoadingContacts(false);
      });
  }, [selectedUserId]);

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
  const regularUsers = users.filter((u) => !(u as any).is_admin);

  const handleToggleContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === userContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(userContacts.map((c) => c.id));
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
          Selecione o usuário, os contatos e o template para disparar mensagens personalizadas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Step 1: User */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              Usuário responsável
            </CardTitle>
            <CardDescription>Quem responderá os clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o usuário..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Step 2: Template */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
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

        {/* Step 3: Contacts */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              Contatos
            </CardTitle>
            <CardDescription>
              {selectedUserId
                ? `${selectedContacts.length} de ${userContacts.length} selecionados`
                : "Selecione o usuário primeiro"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            {!selectedUserId ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Selecione o usuário acima</p>
              </div>
            ) : loadingContacts ? (
              <div className="flex justify-center py-8"><LoadingSpinner size="sm" /></div>
            ) : userContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum contato</p>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleSelectAll} className="mb-2 w-full">
                  {selectedContacts.length === userContacts.length ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
                <ScrollArea className="flex-1 max-h-64">
                  <div className="space-y-1.5">
                    {userContacts.map((contact) => (
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
      </div>

      {/* Send button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSend}
          disabled={
            !selectedTemplate ||
            selectedContacts.length === 0 ||
            isSendingBulk ||
            (phones.length > 0 && !selectedPhoneNumberId)
          }
          className="gap-2 min-w-48"
        >
          {isSendingBulk ? (
            <><LoadingSpinner size="sm" /> Disparando...</>
          ) : (
            <><Send className="h-4 w-4" /> Disparar para {selectedContacts.length} contato{selectedContacts.length !== 1 ? "s" : ""}</>
          )}
        </Button>
      </div>
    </div>
  );
}
