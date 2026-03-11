import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertBanner } from "@/components/ui/alert-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useMetaTemplates, MetaTemplate } from "@/hooks/useMetaTemplates";
import { useContacts } from "@/hooks/useContacts";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { PhoneNumberSelector } from "@/components/chat/PhoneNumberSelector";
import { CreateTemplateDialog } from "@/components/templates/CreateTemplateDialog";
import {
  FileText,
  RefreshCw,
  CheckCircle,
  Clock,
  X,
  Send,
  AlertCircle,
  Users,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide";
import { guides } from "@/components/onboarding/onboardingContent";

const CONTACT_FIELD_OPTIONS = [
  { value: "name", label: "Nome do Cliente" },
  { value: "phone", label: "Telefone" },
  { value: "lawyer_name", label: "Parte Contrária" },
  { value: "process_number", label: "Número do Processo" },
  { value: "cpf", label: "CPF" },
  { value: "valor_da_causa", label: "Valor da Causa" },
];

function extractVariablesFromText(text: string): number[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => parseInt(m.replace(/[{}]/g, ""))))].sort((a, b) => a - b);
}

export default function TemplatesPage() {
  const { templates, allTemplates, isLoading, error, refetch, sendBulk, isSendingBulk, createTemplate, isCreatingTemplate } = useMetaTemplates();
  const { contacts } = useContacts();
  const { phones } = useWabaPhones();
  
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});

  // Auto-select phone if only one available
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedPhoneNumberId]);

  const handleOpenBulkDialog = (template: MetaTemplate) => {
    setSelectedTemplate(template);
    setSelectedContacts([]);
    // Auto-detect variables and pre-populate mappings
    const body = getTemplateBody(template);
    const vars = extractVariablesFromText(body);
    const defaultMappings: Record<string, string> = {};
    vars.forEach((v, i) => {
      // Auto-suggest: first var = name, second = process_number, etc.
      const defaults = ["name", "process_number", "lawyer_name", "cpf", "valor_da_causa", "phone"];
      defaultMappings[String(v)] = defaults[i] || "name";
    });
    setVariableMappings(defaultMappings);
    setShowBulkDialog(true);
  };

  const handleToggleContact = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  const handleSendBulk = () => {
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
      variableMappings: Object.keys(variableMappings).length > 0 ? variableMappings : undefined,
    }, {
      onSuccess: () => {
        setShowBulkDialog(false);
        setSelectedTemplate(null);
        setSelectedContacts([]);
        setVariableMappings({});
      },
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-warning" />;
      case "REJECTED":
        return <X className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "Aprovado";
      case "PENDING":
        return "Aguardando aprovação";
      case "REJECTED":
        return "Rejeitado";
      default:
        return status;
    }
  };

  const getTemplateBody = (template: MetaTemplate): string => {
    const bodyComponent = template.components?.find(c => c.type === "BODY");
    return bodyComponent?.text || "Sem conteúdo";
  };

  return (
    <AppLayout>
      <div className="flex h-screen flex-col overflow-hidden">
        <PageHeader
          title="Templates de Mensagem"
          description="Templates aprovados da sua conta WhatsApp Business"
        >
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Atualizar
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Template
            </Button>
          </div>
        </PageHeader>

        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <AlertBanner type="info" title="Sobre Templates">
              <p>
                Templates são modelos de mensagem pré-aprovados pela Meta. Para enviar a primeira
                mensagem a um cliente, você precisa usar um template aprovado. Após o cliente
                responder, você pode enviar mensagens livres por 24 horas.
              </p>
            </AlertBanner>

            {error && (
              <AlertBanner type="error" title="Erro ao carregar templates">
                <p>{error.message}</p>
                <p className="mt-2 text-sm">
                  Verifique se o WhatsApp está configurado corretamente na página de Configuração.
                </p>
              </AlertBanner>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" text="Carregando templates da Meta..." />
              </div>
            ) : allTemplates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Nenhum template aprovado encontrado
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Crie templates na sua conta Meta Business e aguarde aprovação
                  </p>
                  <Button className="mt-4" variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Verificar novamente
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {allTemplates.map((template) => (
                  <Card key={template.id} className={cn(template.status !== "APPROVED" && "opacity-80")}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg font-mono">{template.name}</CardTitle>
                          <CardDescription>
                            Categoria: {template.category} • Idioma: {template.language}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                              template.status === "APPROVED" &&
                                "bg-success/10 text-success",
                              template.status === "PENDING" &&
                                "bg-warning/10 text-warning",
                              template.status === "REJECTED" &&
                                "bg-destructive/10 text-destructive"
                            )}
                          >
                            {getStatusIcon(template.status)}
                            {getStatusText(template.status)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-lg bg-muted p-4">
                        <p className="whitespace-pre-wrap text-sm">{getTemplateBody(template)}</p>
                      </div>
                      
                      {template.status === "APPROVED" && (
                        <Button 
                          onClick={() => handleOpenBulkDialog(template)}
                          className="w-full"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Disparar para Contatos Selecionados
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Bulk Send Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Disparar Template em Massa</DialogTitle>
            <DialogDescription>
              Selecione o número de disparo e os contatos que receberão o template "{selectedTemplate?.name}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Phone number selector */}
            {phones.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Número de Disparo</label>
                <PhoneNumberSelector
                  phones={phones}
                  selectedPhoneNumberId={selectedPhoneNumberId}
                  onSelect={setSelectedPhoneNumberId}
                />
              </div>
            )}

            {/* Variable mappings */}
            {Object.keys(variableMappings).length > 0 && (
              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <Label className="text-sm font-medium">Variáveis Personalizadas</Label>
                <p className="text-xs text-muted-foreground">
                  Cada variável será substituída pelo dado do contato na hora do envio.
                </p>
                <div className="grid gap-3">
                  {Object.keys(variableMappings).sort((a, b) => parseInt(a) - parseInt(b)).map((varNum) => (
                    <div key={varNum} className="flex items-center gap-3">
                      <span className="text-sm font-mono bg-primary/10 text-primary px-2 py-1 rounded min-w-[50px] text-center">
                        {`{{${varNum}}}`}
                      </span>
                      <span className="text-sm text-muted-foreground">→</span>
                      <Select
                        value={variableMappings[varNum]}
                        onValueChange={(value) => setVariableMappings(prev => ({ ...prev, [varNum]: value }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTACT_FIELD_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedContacts.length} de {contacts.length} selecionado(s)
              </p>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedContacts.length === contacts.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>

            <ScrollArea className="h-[300px] rounded-lg border p-4">
              {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nenhum contato cadastrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg p-3 transition-colors cursor-pointer",
                        selectedContacts.includes(contact.id) 
                          ? "bg-primary/10" 
                          : "hover:bg-muted"
                      )}
                      onClick={() => handleToggleContact(contact.id)}
                    >
                      <Checkbox
                        checked={selectedContacts.includes(contact.id)}
                        onCheckedChange={() => handleToggleContact(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{contact.name}</p>
                        <p className="text-sm text-muted-foreground">{contact.phone}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSendBulk} 
              disabled={selectedContacts.length === 0 || isSendingBulk || (phones.length > 0 && !selectedPhoneNumberId)}
            >
              {isSendingBulk ? (
                <>
                  <LoadingSpinner size="sm" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar para {selectedContacts.length} contato(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateTemplateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={(data) => {
          createTemplate(data, {
            onSuccess: () => setShowCreateDialog(false),
          });
        }}
        isSubmitting={isCreatingTemplate}
      />
      <OnboardingGuide guide={guides.templates} />
    </AppLayout>
  );
}
