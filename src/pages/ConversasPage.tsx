import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useContacts } from "@/hooks/useContacts";
import { useMessages } from "@/hooks/useMessages";
import { useMetaTemplates } from "@/hooks/useMetaTemplates";
import { Contact, Message } from "@/types/juriszap";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Search,
  Send,
  Paperclip,
  Phone,
  FileText,
  MessageSquare,
  Clock,
  CheckCheck,
  Check,
  X,
  Upload,
  FileImage,
  ArrowLeft,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ConversasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { contacts, isLoading: contactsLoading } = useContacts();
  const { templates } = useMetaTemplates();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    searchParams.get("contact")
  );
  const [mobileShowChat, setMobileShowChat] = useState(!!searchParams.get("contact"));
  const [messageText, setMessageText] = useState("");
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docCaption, setDocCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading: messagesLoading, sendMessage, isSending, canSendFreeText, hasMessages } =
    useMessages(selectedContactId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  // Mobile: handle contact selection
  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    if (isMobile) {
      setMobileShowChat(true);
    }
  };

  // Mobile: go back to contact list
  const handleBackToList = () => {
    setMobileShowChat(false);
  };

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
    
    // Check if can send free text
    if (!canSendFreeText) {
      toast.error("Primeiro contato requer template", {
        description: "Use um template aprovado para iniciar a conversa.",
      });
      return;
    }

    sendMessage({
      contactId: selectedContactId,
      message: messageText.trim(),
    });
    setMessageText("");
  };

  const handleSendTemplate = () => {
    if (!selectedTemplateName || !selectedContactId) return;

    const template = templates.find(t => t.name === selectedTemplateName);
    if (!template) return;

    sendMessage({
      contactId: selectedContactId,
      templateName: template.name,
      isTemplate: true,
    });
    setShowTemplateDialog(false);
    setSelectedTemplateName("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Apenas PDF e imagens são permitidos");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 10MB.");
        return;
      }
      setSelectedFile(file);
      setShowDocDialog(true);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendDocument = async () => {
    if (!selectedFile || !selectedContactId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("contactId", selectedContactId);
      if (docCaption.trim()) {
        formData.append("caption", docCaption.trim());
      }

      const { data, error } = await supabase.functions.invoke("upload-document", {
        body: formData,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setShowDocDialog(false);
      setSelectedFile(null);
      setDocCaption("");
    } catch (err: any) {
      toast.error("Erro ao enviar documento", {
        description: err.message,
      });
    } finally {
      setIsUploading(false);
    }
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

  const renderMessageContent = (message: Message) => {
    // Handle image messages
    if (message.message_type === "image" && message.image_url) {
      return (
        <div className="space-y-2">
          <img 
            src={message.image_url} 
            alt="Imagem recebida" 
            className="max-w-full rounded-lg max-h-64 object-cover"
          />
          {message.content && message.content !== "[Imagem recebida]" && (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      );
    }

    // Handle document messages
    if (message.message_type === "document") {
      return (
        <>
          <div className="mb-2 flex items-center gap-2 rounded bg-background/10 p-2">
            <FileText className="h-5 w-5" />
            <span className="text-sm font-medium">
              {message.document_name || "Documento"}
            </span>
          </div>
          {message.content && (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          )}
        </>
      );
    }

    // Text messages
    return <p className="whitespace-pre-wrap text-sm">{message.content}</p>;
  };

  return (
    <AppLayout>
      <div className="flex h-screen overflow-hidden relative">
        {/* Contacts Sidebar */}
        <div className={cn(
          "flex flex-col border-r bg-card",
          isMobile 
            ? cn("absolute inset-0 z-10 transition-transform duration-300", mobileShowChat && "-translate-x-full")
            : "w-80"
        )}>
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
                    onClick={() => handleSelectContact(contact.id)}
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
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="truncate text-xs text-muted-foreground">
                          {contact.phone}
                        </p>
                        <StatusBadge status={contact.status} className="scale-75" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className={cn(
          "flex flex-1 flex-col",
          isMobile && cn("absolute inset-0 z-10 transition-transform duration-300 bg-background", !mobileShowChat && "translate-x-full")
        )}>
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b bg-card px-4 md:px-6 py-3 md:py-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {isMobile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleBackToList}
                      className="shrink-0 -ml-2"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  )}
                  <div className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-full bg-primary text-base md:text-lg font-medium text-primary-foreground">
                    {selectedContact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{selectedContact.name}</h3>
                    <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selectedContact.phone}
                      </span>
                      {selectedContact.process_number && !isMobile && (
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
                      Use um template aprovado para iniciar a conversa
                    </p>
                    <Button 
                      onClick={() => setShowTemplateDialog(true)} 
                      className="mt-4"
                      disabled={templates.length === 0}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Enviar Template
                    </Button>
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
                          {renderMessageContent(message)}
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
                    {isSending && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className={cn("border-t bg-card p-3 md:p-4", isMobile && "pb-6")}>
                {!canSendFreeText && hasMessages && (
                  <div className="mb-3 flex items-center justify-between rounded-lg bg-warning/10 px-3 py-2">
                    <p className="text-sm text-warning">
                      Aguarde resposta do cliente ou use um template
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowTemplateDialog(true)}
                    >
                      <Send className="mr-2 h-3 w-3" />
                      Template
                    </Button>
                  </div>
                )}
                <div className={cn("flex items-end gap-2", isMobile && "gap-1")}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".pdf,application/pdf,image/*"
                    className="hidden"
                  />
                  {isMobile ? (
                    <>
                      <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} className="shrink-0">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setShowTemplateDialog(true)} disabled={templates.length === 0} className="shrink-0">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Enviar arquivo</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowTemplateDialog(true)}
                            disabled={templates.length === 0}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Enviar template</TooltipContent>
                      </Tooltip>
                    </>
                  )}

                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="min-h-[44px] max-h-[120px] resize-none"
                    rows={1}
                    disabled={!canSendFreeText}
                  />

                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || isSending || !canSendFreeText}
                    size="icon"
                  >
                    {isSending ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {!isMobile && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {canSendFreeText 
                      ? "Pressione Enter para enviar. Shift + Enter para nova linha."
                      : "Use um template para iniciar a conversa (política Meta)."
                    }
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className={cn(
              "flex flex-1 flex-col items-center justify-center bg-muted/30",
              isMobile && "hidden"
            )}>
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

      {/* Document Upload Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Arquivo</DialogTitle>
            <DialogDescription>
              Confirme o envio do arquivo selecionado
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile && (
              <div className="flex items-center gap-3 rounded-lg border p-4">
                {selectedFile.type.startsWith("image/") ? (
                  <FileImage className="h-8 w-8 text-info" />
                ) : (
                  <FileText className="h-8 w-8 text-destructive" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="docCaption">Legenda (opcional)</Label>
              <Input
                id="docCaption"
                placeholder="Descrição do arquivo..."
                value={docCaption}
                onChange={(e) => setDocCaption(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDocDialog(false);
              setSelectedFile(null);
              setDocCaption("");
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSendDocument} disabled={isUploading}>
              {isUploading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Template</DialogTitle>
            <DialogDescription>
              Selecione um template aprovado para enviar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum template aprovado disponível. Configure o WhatsApp primeiro.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={selectedTemplateName} onValueChange={setSelectedTemplateName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.name}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSendTemplate} 
              disabled={!selectedTemplateName || isSending}
            >
              {isSending ? (
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
