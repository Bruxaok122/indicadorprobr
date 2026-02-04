import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContacts } from "@/hooks/useContacts";
import { useMetaTemplates } from "@/hooks/useMetaTemplates";
import { LoadingPage, LoadingSpinner } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Search,
  MessageSquare,
  Trash2,
  Users,
  Phone,
  Scale,
  FileText,
  Send,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

export default function ContatosPage() {
  const { contacts, isLoading, deleteContact, isDeleting } = useContacts();
  const { templates, sendBulk, isSendingBulk } = useMetaTemplates();
  
  const [search, setSearch] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showSingleDialog, setShowSingleDialog] = useState(false);
  const [singleContactId, setSingleContactId] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");

  const filteredContacts = contacts.filter((contact) => {
    const searchLower = search.toLowerCase();
    return (
      contact.name.toLowerCase().includes(searchLower) ||
      contact.phone.includes(search) ||
      contact.process_number?.toLowerCase().includes(searchLower) ||
      contact.lawyer_name?.toLowerCase().includes(searchLower)
    );
  });

  const handleToggleContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id));
    }
  };

  const handleOpenBulkDialog = () => {
    if (selectedContacts.length === 0) return;
    setSelectedTemplateName("");
    setShowBulkDialog(true);
  };

  const handleOpenSingleDialog = (contactId: string) => {
    setSingleContactId(contactId);
    setSelectedTemplateName("");
    setShowSingleDialog(true);
  };

  const handleSendBulk = () => {
    if (!selectedTemplateName || selectedContacts.length === 0) return;

    const template = templates.find(t => t.name === selectedTemplateName);
    if (!template) return;

    sendBulk({
      contactIds: selectedContacts,
      templateName: template.name,
      templateLanguage: template.language,
    }, {
      onSuccess: () => {
        setShowBulkDialog(false);
        setSelectedContacts([]);
        setSelectedTemplateName("");
      },
    });
  };

  const handleSendSingle = () => {
    if (!selectedTemplateName || !singleContactId) return;

    const template = templates.find(t => t.name === selectedTemplateName);
    if (!template) return;

    sendBulk({
      contactIds: [singleContactId],
      templateName: template.name,
      templateLanguage: template.language,
    }, {
      onSuccess: () => {
        setShowSingleDialog(false);
        setSingleContactId(null);
        setSelectedTemplateName("");
      },
    });
  };

  const singleContact = contacts.find(c => c.id === singleContactId);

  if (isLoading) {
    return (
      <AppLayout>
        <LoadingPage text="Carregando contatos..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-screen flex-col overflow-hidden">
        <PageHeader
          title="Contatos"
          description={`${contacts.length} cliente(s) cadastrado(s)`}
        >
          <div className="flex items-center gap-2">
            {selectedContacts.length > 0 && (
              <Button onClick={handleOpenBulkDialog} variant="default">
                <Send className="mr-2 h-4 w-4" />
                Disparar Template ({selectedContacts.length})
              </Button>
            )}
            <Button asChild>
              <Link to="/importar">
                <Users className="mr-2 h-4 w-4" />
                Importar
              </Link>
            </Button>
          </div>
        </PageHeader>

        <div className="flex-1 overflow-hidden p-6">
          <div className="flex h-full flex-col space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone, processo ou advogado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Table */}
            <Card className="flex-1 overflow-hidden">
              <CardContent className="h-full overflow-auto p-0">
                {filteredContacts.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-12">
                    <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-lg font-medium text-muted-foreground">
                      {search ? "Nenhum contato encontrado" : "Nenhum contato cadastrado"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {search
                        ? "Tente buscar por outro termo"
                        : "Importe sua lista jurídica para começar"}
                    </p>
                    {!search && (
                      <Button asChild variant="outline" className="mt-4">
                        <Link to="/importar">Importar Lista</Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Processo</TableHead>
                        <TableHead>Advogado</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Última Mensagem</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedContacts.includes(contact.id)}
                              onCheckedChange={() => handleToggleContact(contact.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                <span className="text-sm font-medium text-primary">
                                  {contact.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium">{contact.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 font-mono text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {contact.phone}
                            </div>
                          </TableCell>
                          <TableCell>
                            {contact.process_number ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-1 text-sm">
                                    <FileText className="h-3 w-3 text-muted-foreground" />
                                    <span className="max-w-[150px] truncate">
                                      {contact.process_number}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{contact.process_number}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {contact.lawyer_name ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Scale className="h-3 w-3 text-muted-foreground" />
                                {contact.lawyer_name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={contact.status} />
                          </TableCell>
                          <TableCell>
                            {contact.last_message_at ? (
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(contact.last_message_at), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleOpenSingleDialog(contact.id)}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Enviar template</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    asChild
                                    className="h-8 w-8"
                                  >
                                    <Link to={`/conversas?contact=${contact.id}`}>
                                      <MessageSquare className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Abrir conversa</TooltipContent>
                              </Tooltip>

                              <AlertDialog>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir contato</TooltipContent>
                                </Tooltip>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. O contato{" "}
                                      <strong>{contact.name}</strong> e todo o histórico de
                                      mensagens serão removidos permanentemente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteContact(contact.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Bulk Send Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disparar Template em Massa</DialogTitle>
            <DialogDescription>
              Enviar template para {selectedContacts.length} contato(s) selecionado(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Selecione o Template</Label>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum template aprovado disponível. Configure o WhatsApp primeiro.
                </p>
              ) : (
                <Select value={selectedTemplateName} onValueChange={setSelectedTemplateName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um template aprovado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.name}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendBulk}
              disabled={!selectedTemplateName || isSendingBulk}
            >
              {isSendingBulk ? (
                <>
                  <LoadingSpinner size="sm" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Send Dialog */}
      <Dialog open={showSingleDialog} onOpenChange={setShowSingleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Template Individual</DialogTitle>
            <DialogDescription>
              Enviar template para {singleContact?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {singleContact && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <span className="font-medium text-primary">
                    {singleContact.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{singleContact.name}</p>
                  <p className="text-sm text-muted-foreground">{singleContact.phone}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Selecione o Template</Label>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum template aprovado disponível. Configure o WhatsApp primeiro.
                </p>
              ) : (
                <Select value={selectedTemplateName} onValueChange={setSelectedTemplateName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um template aprovado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.name}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSingleDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendSingle}
              disabled={!selectedTemplateName || isSendingBulk}
            >
              {isSendingBulk ? (
                <>
                  <LoadingSpinner size="sm" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
