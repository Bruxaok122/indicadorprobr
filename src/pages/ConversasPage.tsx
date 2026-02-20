import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useContacts } from "@/hooks/useContacts";
import { useMessages } from "@/hooks/useMessages";
import { useMetaTemplates } from "@/hooks/useMetaTemplates";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageSquare } from "lucide-react";

import { ChatContactList } from "@/components/chat/ChatContactList";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatInput } from "@/components/chat/ChatInput";
import { ContactProfileDrawer } from "@/components/chat/ContactProfileDrawer";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Send, Upload, FileText, FileImage } from "lucide-react";
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

export default function ConversasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { contacts, isLoading: contactsLoading, toggleContactBlock, isTogglingBlock, refetchContacts } = useContacts();
  const { templates } = useMetaTemplates();
  const { phones } = useWabaPhones();
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
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  const {
    messages,
    isLoading: messagesLoading,
    sendMessage,
    isSending,
    canSendFreeText,
    hasMessages,
    sendAudio,
    isSendingAudio,
  } = useMessages(selectedContactId);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  // Auto-select phone if only one available
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedPhoneNumberId]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    if (isMobile) setMobileShowChat(true);
  };

  const handleBackToList = () => setMobileShowChat(false);

  useEffect(() => {
    if (selectedContactId) {
      setSearchParams({ contact: selectedContactId });
    } else {
      setSearchParams({});
    }
  }, [selectedContactId, setSearchParams]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedContactId) return;
    if (!canSendFreeText) {
      toast.error("Primeiro contato requer template", {
        description: "Use um template aprovado para iniciar a conversa.",
      });
      return;
    }
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }
    sendMessage({
      contactId: selectedContactId,
      message: messageText.trim(),
      selectedPhoneNumberId: selectedPhoneNumberId || undefined,
    });
    setMessageText("");
  };

  const handleSendTemplate = () => {
    if (!selectedTemplateName || !selectedContactId) return;
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }
    const template = templates.find((t) => t.name === selectedTemplateName);
    if (!template) return;
    sendMessage({
      contactId: selectedContactId,
      templateName: template.name,
      isTemplate: true,
      selectedPhoneNumberId: selectedPhoneNumberId || undefined,
    });
    setShowTemplateDialog(false);
    setSelectedTemplateName("");
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setShowDocDialog(true);
  };

  const handleSendDocument = async () => {
    if (!selectedFile || !selectedContactId) return;
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("contactId", selectedContactId);
      if (docCaption.trim()) formData.append("caption", docCaption.trim());
      if (selectedPhoneNumberId) formData.append("selectedPhoneNumberId", selectedPhoneNumberId);

      const { data, error } = await supabase.functions.invoke("upload-document", {
        body: formData,
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setShowDocDialog(false);
      setSelectedFile(null);
      setDocCaption("");
    } catch (err: any) {
      toast.error("Erro ao enviar documento", { description: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppLayout>
      <div className={cn("flex flex-col overflow-hidden relative min-h-0", isMobile ? "h-[calc(100dvh-3.5rem)]" : "h-screen")}>
        {/* Working context banner */}
        {phones.length > 0 && (() => {
          const activePhone = phones[0];
          const lawyerName = (activePhone as any).lawyer_name;
          return (
            <div className="bg-primary/15 border-b border-primary/30 px-4 py-2.5 flex items-center gap-3 shrink-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <span className="text-primary text-xs">📞</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="text-sm font-medium text-foreground">
                  Número ativo: <span className="text-primary font-bold">{activePhone.display_phone_number}</span>
                </span>
                {lawyerName && (
                  <span className="text-sm font-medium text-foreground">
                    · Advogado: <span className="text-primary font-bold">{lawyerName}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })()}
        <div className={cn("flex flex-1 overflow-hidden relative min-h-0")}>
        {/* Contact list */}
        <ChatContactList
          contacts={contacts}
          isLoading={contactsLoading}
          search={search}
          setSearch={setSearch}
          selectedContactId={selectedContactId}
          onSelectContact={handleSelectContact}
          isMobile={isMobile}
          mobileShowChat={mobileShowChat}
        />

        {/* Chat area */}
        <div
          className={cn(
            "flex flex-1 flex-col min-h-0 min-w-0",
            isMobile &&
              cn(
                "absolute inset-0 z-20 transition-transform duration-300 bg-background h-full",
                !mobileShowChat && "translate-x-full"
              )
          )}
        >
          {selectedContact ? (
            <>
              <ChatHeader
                contact={selectedContact}
                isMobile={isMobile}
                onBack={handleBackToList}
                onToggleBlock={(contactId, blocked) => toggleContactBlock({ contactId, blocked })}
                isTogglingBlock={isTogglingBlock}
                onOpenProfile={() => setShowProfileDrawer(true)}
                onTransferDone={() => {
                  setSelectedContactId(null);
                  if (isMobile) setMobileShowChat(false);
                  // Force immediate removal from contact list
                  refetchContacts();
                }}
              />
              
              <ChatMessages
                messages={messages}
                isLoading={messagesLoading}
                isSending={isSending}
                templatesAvailable={templates.length > 0}
                onOpenTemplateDialog={() => setShowTemplateDialog(true)}
              />
              <ChatInput
                messageText={messageText}
                setMessageText={setMessageText}
                canSendFreeText={canSendFreeText}
                hasMessages={hasMessages}
                isSending={isSending || isSendingAudio}
                isMobile={isMobile}
                templatesAvailable={templates.length > 0}
                isContactBlocked={selectedContact.status === "encerrado"}
                onSendMessage={handleSendMessage}
                onOpenTemplateDialog={() => setShowTemplateDialog(true)}
                onFileSelected={handleFileSelected}
                onSendAudio={(blob) => {
                  if (!selectedContactId) return;
                  sendAudio({
                    contactId: selectedContactId,
                    audioBlob: blob,
                    selectedPhoneNumberId: selectedPhoneNumberId || undefined,
                  });
                }}
              />
            </>
          ) : (
            <div
              className={cn(
                "flex flex-1 flex-col items-center justify-center chat-wallpaper",
                isMobile && "hidden"
              )}
            >
              <MessageSquare className="mb-4 h-16 w-16 text-muted-foreground/30" />
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
      </div>

      {/* Document Upload Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Arquivo</DialogTitle>
            <DialogDescription>Confirme o envio do arquivo selecionado</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile && (
              <div className="flex items-center gap-3 rounded-lg border p-4">
                {selectedFile.type.startsWith("image/") ? (
                  <FileImage className="h-8 w-8 text-info shrink-0" />
                ) : (
                  <FileText className="h-8 w-8 text-destructive shrink-0" />
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
            <Button
              variant="outline"
              onClick={() => {
                setShowDocDialog(false);
                setSelectedFile(null);
                setDocCaption("");
              }}
            >
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
            <DialogDescription>Selecione um template aprovado para enviar</DialogDescription>
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
            <Button onClick={handleSendTemplate} disabled={!selectedTemplateName || isSending}>
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

      {/* Contact Profile Drawer */}
      <ContactProfileDrawer
        contact={selectedContact ?? null}
        open={showProfileDrawer}
        onOpenChange={setShowProfileDrawer}
      />
    </AppLayout>
  );
}
