import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useContacts } from "@/hooks/useContacts";
import { useMessages } from "@/hooks/useMessages";
import { useMetaTemplates } from "@/hooks/useMetaTemplates";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageSquare, Send, Upload, FileText, FileImage, Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { ChatContactList } from "@/components/chat/ChatContactList";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatInput } from "@/components/chat/ChatInput";
import { ContactProfileDrawer } from "@/components/chat/ContactProfileDrawer";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function ConversasPage() {
  const { isAdmin } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { contacts, isLoading: contactsLoading, toggleContactBlock, isTogglingBlock } = useContacts();
  const { templates } = useMetaTemplates();
  const { phones } = useWabaPhones();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(searchParams.get("contact"));
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
    messages, isLoading: messagesLoading, sendMessage, isSending, canSendFreeText, hasMessages, sendAudio, isSendingAudio,
  } = useMessages(selectedContactId);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  // Get operator's active phone and lawyer
  const activePhone = phones.find((p) => p.phone_number_id === selectedPhoneNumberId) || phones[0];
  const operatorPhone = activePhone?.display_phone_number;
  const operatorLawyer = activePhone?.lawyer_name;

  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) setSelectedPhoneNumberId(phones[0].phone_number_id);
  }, [phones, selectedPhoneNumberId]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    if (isMobile) setMobileShowChat(true);
  };

  const handleBackToList = () => setMobileShowChat(false);

  useEffect(() => {
    if (selectedContactId) setSearchParams({ contact: selectedContactId });
    else setSearchParams({});
  }, [selectedContactId, setSearchParams]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedContactId) return;
    if (!canSendFreeText) { toast.error("Primeiro contato requer template"); return; }
    if (phones.length > 0 && !selectedPhoneNumberId) { toast.error("Selecione um número de disparo"); return; }
    sendMessage({ contactId: selectedContactId, message: messageText.trim(), selectedPhoneNumberId: selectedPhoneNumberId || undefined });
    setMessageText("");
  };

  const handleSendTemplate = () => {
    if (!selectedTemplateName || !selectedContactId) return;
    if (phones.length > 0 && !selectedPhoneNumberId) { toast.error("Selecione um número de disparo"); return; }
    const template = templates.find((t) => t.name === selectedTemplateName);
    if (!template) return;
    sendMessage({ contactId: selectedContactId, templateName: template.name, isTemplate: true, selectedPhoneNumberId: selectedPhoneNumberId || undefined });
    setShowTemplateDialog(false);
    setSelectedTemplateName("");
  };

  const handleFileSelected = (file: File) => { setSelectedFile(file); setShowDocDialog(true); };

  const handleSendDocument = async () => {
    if (!selectedFile || !selectedContactId) return;
    if (phones.length > 0 && !selectedPhoneNumberId) { toast.error("Selecione um número de disparo"); return; }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("contactId", selectedContactId);
      if (docCaption.trim()) formData.append("caption", docCaption.trim());
      if (selectedPhoneNumberId) formData.append("selectedPhoneNumberId", selectedPhoneNumberId);
      const { data, error } = await supabase.functions.invoke("upload-document", { body: formData });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setShowDocDialog(false); setSelectedFile(null); setDocCaption("");
    } catch (err: any) {
      toast.error("Erro ao enviar documento", { description: err.message });
    } finally { setIsUploading(false); }
  };

  const Wrapper = isAdmin ? AppLayout : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  // Theme toggle for operator (no sidebar)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <Wrapper>
      <div className={cn(
        "flex flex-col overflow-hidden relative min-h-0 transition-colors duration-300",
        "bg-muted dark:bg-background",
        isMobile && !isAdmin ? "h-[100dvh]" : isMobile ? "h-[calc(100dvh-3.5rem)]" : "h-screen"
      )}>
        {/* Operator theme toggle floating button */}
        {!isAdmin && !isMobile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
            className="absolute top-3 right-3 z-30"
          >
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center h-9 w-9 rounded-full bg-card dark:bg-card border border-border shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <AnimatePresence mode="wait">
                {isDark ? (
                  <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Sun className="h-4 w-4 text-amber-400" />
                  </motion.div>
                ) : (
                  <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Moon className="h-4 w-4 text-foreground/70" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        )}

        <div className={cn("flex flex-1 overflow-hidden relative min-h-0", !isMobile && "gap-0")}>
          {/* Contact list */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn(
              isMobile
                ? cn("absolute inset-0 z-10 transition-transform duration-300 h-full", mobileShowChat && "-translate-x-full")
                : "w-[340px] h-full flex-shrink-0"
            )}
          >
            <ChatContactList
              contacts={contacts} isLoading={contactsLoading} search={search} setSearch={setSearch}
              selectedContactId={selectedContactId} onSelectContact={handleSelectContact}
              isMobile={isMobile} mobileShowChat={mobileShowChat}
              operatorPhone={!isAdmin ? operatorPhone : undefined}
              operatorLawyer={!isAdmin ? operatorLawyer : undefined}
            />
          </motion.div>

          {/* Chat area with 3D floating effect */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
            className={cn(
              "flex flex-1 flex-col min-h-0 min-w-0 relative",
              !isMobile && "chat-panel-float rounded-l-2xl my-1 mr-1 overflow-hidden",
              isMobile && cn("absolute inset-0 z-20 transition-transform duration-300 h-full", !mobileShowChat && "translate-x-full")
            )}
          >
            {selectedContact ? (
              <>
                <ChatHeader
                  contact={selectedContact} isMobile={isMobile} onBack={handleBackToList}
                  onToggleBlock={(contactId, blocked) => toggleContactBlock({ contactId, blocked })}
                  isTogglingBlock={isTogglingBlock}
                  onOpenProfile={() => setShowProfileDrawer(true)}
                  onTransferDone={() => {
                    setSelectedContactId(null);
                    if (isMobile) setMobileShowChat(false);
                    queryClient.invalidateQueries({ queryKey: ["contacts"] });
                    queryClient.refetchQueries({ queryKey: ["contacts"] });
                  }}
                />
                <ChatMessages
                  messages={messages} isLoading={messagesLoading} isSending={isSending}
                  templatesAvailable={templates.length > 0} onOpenTemplateDialog={() => setShowTemplateDialog(true)}
                />
                <ChatInput
                  messageText={messageText} setMessageText={setMessageText} canSendFreeText={canSendFreeText}
                  hasMessages={hasMessages} isSending={isSending || isSendingAudio} isMobile={isMobile}
                  templatesAvailable={templates.length > 0} isContactBlocked={selectedContact.status === "encerrado"}
                  onSendMessage={handleSendMessage} onOpenTemplateDialog={() => setShowTemplateDialog(true)}
                  onFileSelected={handleFileSelected}
                  onSendAudio={(blob) => {
                    if (!selectedContactId) return;
                    sendAudio({ contactId: selectedContactId, audioBlob: blob, selectedPhoneNumberId: selectedPhoneNumberId || undefined });
                  }}
                />
              </>
            ) : (
              <div className={cn("flex flex-1 flex-col items-center justify-center chat-wallpaper", isMobile && "hidden")}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="flex flex-col items-center"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-card/80 shadow-lg mb-5">
                    <MessageSquare className="h-10 w-10 text-green-500/40" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground/60">Selecione uma conversa</h3>
                  <p className="text-sm text-muted-foreground mt-1">Escolha um contato ao lado para iniciar</p>
                </motion.div>
              </div>
            )}
          </motion.div>
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
                {selectedFile.type.startsWith("image/") ? <FileImage className="h-8 w-8 text-blue-500 shrink-0" /> : <FileText className="h-8 w-8 text-red-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="docCaption">Legenda (opcional)</Label>
              <Input id="docCaption" placeholder="Descrição do arquivo..." value={docCaption} onChange={(e) => setDocCaption(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDocDialog(false); setSelectedFile(null); setDocCaption(""); }}>Cancelar</Button>
            <Button onClick={handleSendDocument} disabled={isUploading} className="bg-green-500 hover:bg-green-600 text-white">
              {isUploading ? <><LoadingSpinner size="sm" /> Enviando...</> : <><Upload className="mr-2 h-4 w-4" /> Enviar</>}
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
              <p className="text-sm text-gray-500">Nenhum template aprovado disponível.</p>
            ) : (
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={selectedTemplateName} onValueChange={setSelectedTemplateName}>
                  <SelectTrigger><SelectValue placeholder="Escolha um template..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (<SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancelar</Button>
            <Button onClick={handleSendTemplate} disabled={!selectedTemplateName || isSending} className="bg-green-500 hover:bg-green-600 text-white">
              {isSending ? <><LoadingSpinner size="sm" /> Enviando...</> : <><Send className="mr-2 h-4 w-4" /> Enviar Template</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Profile Drawer */}
      <ContactProfileDrawer contact={selectedContact ?? null} open={showProfileDrawer} onOpenChange={setShowProfileDrawer} />
    </Wrapper>
  );
}
