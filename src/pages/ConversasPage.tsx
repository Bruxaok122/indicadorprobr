import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { MessageSquare, Send, Upload, FileText, FileImage } from "lucide-react";
import { DispatchCountdown } from "@/components/chat/DispatchCountdown";

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
  const { isAdmin, profile, signOut } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { contacts, isLoading: contactsLoading, toggleContactBlock, isTogglingBlock, togglePriority, isTogglingPriority, clearAllContacts, isClearingAll } = useContacts();
  const { templates } = useMetaTemplates();
  const { phones } = useWabaPhones();
  const isMobile = useIsMobile();
  const { enabled: notificationEnabled, toggle: toggleNotification, play: playNotification } = useNotificationSound();

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
  const [isTogglingAI, setIsTogglingAI] = useState(false);
  const lastReplyStatusByContactRef = useRef<Record<string, string | null | undefined>>({});
  const replyStatusInitializedRef = useRef(false);
  const lastSelectedIncomingMessageRef = useRef<string | null>(null);

  const {
    messages, isLoading: messagesLoading, sendMessage, isSending, canSendFreeText, hasMessages, sendAudio, isSendingAudio, deleteMessage, sendReaction,
  } = useMessages(selectedContactId);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  // Unread message counts (per contact, per operator)
  const contactIds = useMemo(() => contacts.map((c) => c.id), [contacts]);
  const { counts: unreadCounts, markAsRead } = useUnreadCounts(contactIds);

  // Mark selected contact as read whenever it changes or new messages arrive while open
  useEffect(() => {
    if (selectedContactId) markAsRead(selectedContactId);
  }, [selectedContactId, messages?.length, markAsRead]);

  // Fetch dispatched phone info directly from DB when not in operator's phones list
  const dispatchedPhoneId = selectedContact?.dispatched_phone_number_id;
  const { data: dispatchedPhoneInfo } = useQuery({
    queryKey: ["dispatched-phone-info", dispatchedPhoneId],
    queryFn: async () => {
      if (!dispatchedPhoneId) return null;
      const { data } = await supabase
        .from("waba_phone_numbers")
        .select("phone_number_id, display_phone_number, verified_name, lawyer_name")
        .eq("phone_number_id", dispatchedPhoneId)
        .maybeSingle();
      return data;
    },
    enabled: !!dispatchedPhoneId,
    staleTime: 60000,
  });

  // Get operator's active phone and lawyer — prioritize dispatched phone info
  const activePhone = phones.find((p) => p.phone_number_id === selectedPhoneNumberId) || phones[0];
  const operatorPhone = dispatchedPhoneInfo?.display_phone_number || activePhone?.display_phone_number;
  const operatorLawyer = dispatchedPhoneInfo?.lawyer_name || activePhone?.lawyer_name || dispatchedPhoneInfo?.verified_name || activePhone?.verified_name;

  // Auto-select the dispatched phone number for this contact, or fallback to first available
  useEffect(() => {
    if (phones.length === 0) return;
    const contactDispatchedPhone = selectedContact?.dispatched_phone_number_id;
    if (contactDispatchedPhone && phones.some(p => p.phone_number_id === contactDispatchedPhone)) {
      setSelectedPhoneNumberId(contactDispatchedPhone);
    } else {
      // Always fallback to first phone when contact has no dispatched phone
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedContact]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    if (isMobile) setMobileShowChat(true);
  };

  const handleBackToList = () => setMobileShowChat(false);

  useEffect(() => {
    if (selectedContactId) setSearchParams({ contact: selectedContactId }, { replace: true });
    else setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContactId]);

  // Play notification only when another contact transitions to "respondido"
  // (first customer reply after staying in pending/shared pending)
  useEffect(() => {
    if (!contacts || contacts.length === 0) return;

    const nextStatuses = Object.fromEntries(contacts.map((contact) => [contact.id, contact.status]));

    if (!replyStatusInitializedRef.current) {
      lastReplyStatusByContactRef.current = nextStatuses;
      replyStatusInitializedRef.current = true;
      return;
    }

    const hasNewCustomerReply = contacts.some((contact) => {
      const previousStatus = lastReplyStatusByContactRef.current[contact.id];
      return contact.id !== selectedContactId && contact.status === "respondido" && previousStatus !== "respondido";
    });

    lastReplyStatusByContactRef.current = nextStatuses;

    if (hasNewCustomerReply) {
      playNotification();
    }
  }, [contacts, playNotification, selectedContactId]);

  // Reset incoming-tracking when switching contacts to avoid playing sound on chat switch
  useEffect(() => {
    lastSelectedIncomingMessageRef.current = null;
  }, [selectedContactId]);

  useEffect(() => {
    if (!selectedContactId || !messages || messages.length === 0) return;

    const lastIncoming = [...messages]
      .reverse()
      .find((message) => message.direction === "incoming");

    if (!lastIncoming) return;

    // First time we see messages for this contact — initialize without playing
    if (lastSelectedIncomingMessageRef.current === null) {
      lastSelectedIncomingMessageRef.current = lastIncoming.id;
      return;
    }

    if (lastIncoming.id !== lastSelectedIncomingMessageRef.current) {
      lastSelectedIncomingMessageRef.current = lastIncoming.id;
      playNotification();
    }
  }, [messages, playNotification, selectedContactId]);

  const handleToggleAI = async (contactId: string, enabled: boolean) => {
    setIsTogglingAI(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ 
          ai_enabled: enabled, 
          ai_stage: enabled ? "aguardando_confirmacao_doc" : null 
        } as any)
        .eq("id", contactId);
      if (error) throw error;
      toast.success(enabled ? "🤖 IA ativada! Monitorando e respondendo." : "IA desativada. Modo manual.");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch (err: any) {
      toast.error("Erro ao alternar IA", { description: err.message });
    } finally {
      setIsTogglingAI(false);
    }
  };

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

  // Wrapper defined conditionally — avoid inline component to prevent remount

  // Theme toggle for operator (no sidebar) — light is default
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      document.documentElement.classList.remove("dark");
      return false;
    }
    // Default to dark
    document.documentElement.classList.add("dark");
    if (!saved) localStorage.setItem("theme", "dark");
    return true;
  });
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const chatContent = (
    <>
      <div className={cn(
        "flex flex-col overflow-hidden relative min-h-0 transition-colors duration-300",
        "bg-muted dark:bg-background",
        isMobile && !isAdmin && !(profile as any)?.can_manage_numbers && !(profile as any)?.can_dispatch
          ? "h-[100dvh]"
          : isMobile
            ? "h-[calc(100dvh-3.5rem)]"
            : isAdmin || (profile as any)?.can_manage_numbers || (profile as any)?.can_dispatch
              ? "h-[calc(100vh-3.5rem)]"
              : "h-screen"
      )}>
        <div className={cn("flex flex-1 overflow-hidden relative min-h-0", !isMobile && "gap-3 p-2 pr-2")}>
          {/* Contact list with 3D effect */}
          <div
            className={cn(
              isMobile
                ? cn("absolute inset-0 z-10 transition-transform duration-300 h-full", mobileShowChat && "-translate-x-full")
                : "w-[340px] h-full flex-shrink-0 rounded-2xl overflow-hidden contact-list-float"
            )}
          >
            <ChatContactList
              contacts={contacts} isLoading={contactsLoading} search={search} setSearch={setSearch}
              selectedContactId={selectedContactId} onSelectContact={handleSelectContact}
              isMobile={isMobile} mobileShowChat={mobileShowChat}
              operatorPhone={operatorPhone}
              operatorLawyer={operatorLawyer}
              operatorName={profile?.full_name}
              isDark={!isAdmin ? isDark : undefined}
              onToggleTheme={!isAdmin ? toggleTheme : undefined}
              onLogout={!isAdmin ? signOut : undefined}
              onClearAll={() => { setSelectedContactId(null); clearAllContacts(); }}
              isClearingAll={isClearingAll}
              notificationEnabled={notificationEnabled}
              onToggleNotification={toggleNotification}
              unreadCounts={unreadCounts}
            />
          </div>

          {/* Chat area with 3D floating effect */}
          <div
            className={cn(
              "flex flex-1 flex-col min-h-0 min-w-0 relative",
              !isMobile && "chat-panel-float rounded-2xl overflow-hidden",
              isMobile && cn("absolute inset-0 z-20 transition-transform duration-300 h-full", !mobileShowChat && "translate-x-full")
            )}
          >
            <DispatchCountdown />
            {selectedContact ? (
              <>
                <ChatHeader
                  contact={selectedContact} isMobile={isMobile} onBack={handleBackToList}
                  onToggleBlock={(contactId, blocked) => toggleContactBlock({ contactId, blocked })}
                  isTogglingBlock={isTogglingBlock}
                  onOpenProfile={() => setShowProfileDrawer(true)}
                  onTogglePriority={(contactId, isPriority) => togglePriority({ contactId, isPriority })}
                  isTogglingPriority={isTogglingPriority}
                  lawyerName={operatorLawyer}
                  aiEnabled={(selectedContact as any).ai_enabled}
                  aiStage={(selectedContact as any).ai_stage}
                  onToggleAI={handleToggleAI}
                  isTogglingAI={isTogglingAI}
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
                  onDeleteMessage={deleteMessage}
                  onReact={(messageId, emoji) => sendReaction({ messageId, emoji })}
                />
                <ChatInput
                  messageText={messageText} setMessageText={setMessageText} canSendFreeText={canSendFreeText}
                  hasMessages={hasMessages} isSending={isSending || isSendingAudio} isMobile={isMobile}
                  templatesAvailable={templates.length > 0} isContactBlocked={selectedContact.status === "encerrado"}
                  isReadOnly={
                    !isAdmin &&
                    (selectedContact as any).dispatch_mode === "shared" &&
                    !(selectedContact as any).claimed_by
                  }
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
                <div className="flex flex-col items-center animate-fade-in">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-card/80 shadow-lg mb-5">
                    <MessageSquare className="h-10 w-10 text-green-500/40" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground/60">Selecione uma conversa</h3>
                  <p className="text-sm text-muted-foreground mt-1">Escolha um contato ao lado para iniciar</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Upload Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Enviar Arquivo</DialogTitle>
            <DialogDescription>Confirme o envio do arquivo selecionado</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile && (
              <div className="flex items-center gap-3 rounded-lg border p-3 overflow-hidden">
                {selectedFile.type.startsWith("image/") ? <FileImage className="h-8 w-8 text-blue-500 shrink-0" /> : <FileText className="h-8 w-8 text-red-500 shrink-0" />}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="font-medium truncate text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="docCaption">Legenda (opcional)</Label>
              <Input id="docCaption" placeholder="Descrição do arquivo..." value={docCaption} onChange={(e) => setDocCaption(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
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
    </>
  );

  if (isAdmin || (profile as any)?.can_manage_numbers || (profile as any)?.can_dispatch) {
    return <AppLayout>{chatContent}</AppLayout>;
  }

  return chatContent;
}
