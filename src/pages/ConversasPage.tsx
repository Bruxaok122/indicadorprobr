import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useContacts } from "@/hooks/useContacts";
import { useMessages } from "@/hooks/useMessages";
import { Contact, Message } from "@/types/juriszap";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Search,
  Send,
  Paperclip,
  Phone,
  User,
  FileText,
  MessageSquare,
  Clock,
  CheckCheck,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ConversasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { contacts, isLoading: contactsLoading } = useContacts();

  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    searchParams.get("contact")
  );
  const [messageText, setMessageText] = useState("");
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [docUrl, setDocUrl] = useState("");
  const [docName, setDocName] = useState("");
  const [docCaption, setDocCaption] = useState("");

  const { messages, isLoading: messagesLoading, sendMessage, isSending, sendDocument, isSendingDocument } =
    useMessages(selectedContactId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  const filteredContacts = contacts.filter((contact) => {
    const searchLower = search.toLowerCase();
    return (
      contact.name.toLowerCase().includes(searchLower) ||
      contact.phone.includes(search)
    );
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update URL when contact changes
  useEffect(() => {
    if (selectedContactId) {
      setSearchParams({ contact: selectedContactId });
    } else {
      setSearchParams({});
    }
  }, [selectedContactId, setSearchParams]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedContactId) return;

    sendMessage({
      contactId: selectedContactId,
      message: messageText.trim(),
    });
    setMessageText("");
  };

  const handleSendDocument = () => {
    if (!docUrl.trim() || !selectedContactId) return;

    sendDocument({
      contactId: selectedContactId,
      documentUrl: docUrl.trim(),
      documentName: docName.trim() || "documento.pdf",
      caption: docCaption.trim() || undefined,
    });
    setShowDocDialog(false);
    setDocUrl("");
    setDocName("");
    setDocCaption("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageStatusIcon = (status: Message["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-info" />;
      case "failed":
        return <X className="h-3 w-3 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="flex h-screen overflow-hidden">
        {/* Contacts Sidebar */}
        <div className="flex w-80 flex-col border-r bg-card">
          <div className="border-b p-4">
            <h2 className="mb-3 text-lg font-semibold">Conversas</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar contato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {contactsLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum contato encontrado</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContactId(contact.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
                      selectedContactId === contact.id
                        ? "bg-primary/10"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate font-medium">{contact.name}</p>
                        <StatusBadge status={contact.status} className="scale-90" />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {contact.phone}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex flex-1 flex-col">
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b bg-card px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-medium text-primary-foreground">
                    {selectedContact.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedContact.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selectedContact.phone}
                      </span>
                      {selectedContact.process_number && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {selectedContact.process_number}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <StatusBadge status={selectedContact.status} />
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1 bg-muted/30 p-4">
                {messagesLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <LoadingSpinner size="lg" text="Carregando mensagens..." />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-lg font-medium text-muted-foreground">
                      Nenhuma mensagem ainda
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Envie a primeira mensagem para iniciar a conversa
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          message.direction === "outgoing" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-4 py-2",
                            message.direction === "outgoing"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card"
                          )}
                        >
                          {message.message_type === "document" && (
                            <div className="mb-2 flex items-center gap-2 rounded bg-background/10 p-2">
                              <FileText className="h-5 w-5" />
                              <span className="text-sm font-medium">
                                {message.document_name || "Documento"}
                              </span>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                          <div
                            className={cn(
                              "mt-1 flex items-center justify-end gap-1 text-xs",
                              message.direction === "outgoing"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            )}
                          >
                            <span>
                              {format(new Date(message.created_at), "HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                            {message.direction === "outgoing" && getMessageStatusIcon(message.status)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="border-t bg-card p-4">
                <div className="flex items-end gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowDocDialog(true)}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Enviar documento PDF</TooltipContent>
                  </Tooltip>

                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="min-h-[44px] max-h-[120px] resize-none"
                    rows={1}
                  />

                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || isSending}
                    size="icon"
                  >
                    {isSending ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Pressione Enter para enviar. Shift + Enter para nova linha.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center bg-muted/30">
              <MessageSquare className="mb-4 h-16 w-16 text-muted-foreground/50" />
              <h3 className="text-xl font-medium text-muted-foreground">
                Selecione uma conversa
              </h3>
              <p className="text-sm text-muted-foreground">
                Escolha um contato ao lado para iniciar
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Document Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Documento PDF</DialogTitle>
            <DialogDescription>
              Insira a URL do documento que deseja enviar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="docUrl">URL do Documento *</Label>
              <Input
                id="docUrl"
                placeholder="https://exemplo.com/documento.pdf"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O documento deve estar hospedado em uma URL pública acessível
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="docName">Nome do Arquivo</Label>
              <Input
                id="docName"
                placeholder="contrato.pdf"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="docCaption">Legenda (opcional)</Label>
              <Input
                id="docCaption"
                placeholder="Segue o documento solicitado..."
                value={docCaption}
                onChange={(e) => setDocCaption(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendDocument} disabled={!docUrl.trim() || isSendingDocument}>
              {isSendingDocument ? (
                <>
                  <LoadingSpinner size="sm" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Documento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
