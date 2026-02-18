import { useState, useEffect, useRef } from "react";
import { Profile, Message } from "@/types/juriszap";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatDateSeparator } from "@/components/chat/ChatDateSeparator";
import { Eye, MessageSquare, Users } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminChatMonitorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile | null;
}

interface ContactWithMessages {
  id: string;
  name: string;
  phone: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export function AdminChatMonitor({ open, onOpenChange, user }: AdminChatMonitorProps) {
  const [contacts, setContacts] = useState<ContactWithMessages[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user's contacts when dialog opens
  useEffect(() => {
    if (!open || !user) {
      setContacts([]);
      setSelectedContactId(null);
      setMessages([]);
      return;
    }

    const fetchContacts = async () => {
      setIsLoadingContacts(true);
      try {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, name, phone, last_message_at")
          .eq("user_id", user.user_id)
          .order("last_message_at", { ascending: false, nullsFirst: false });

        if (error) throw error;

        setContacts(
          (data || []).map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            lastMessageAt: c.last_message_at || undefined,
            unreadCount: 0,
          }))
        );
      } catch (err) {
        console.error("Error fetching contacts:", err);
      } finally {
        setIsLoadingContacts(false);
      }
    };

    fetchContacts();
  }, [open, user]);

  // Load messages for selected contact
  useEffect(() => {
    if (!selectedContactId || !user) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("contact_id", selectedContactId)
          .eq("user_id", user.user_id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setMessages((data || []) as unknown as Message[]);
      } catch (err) {
        console.error("Error fetching messages:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();

    // Subscribe to realtime updates for this contact's messages
    const channel = supabase
      .channel(`admin-monitor-${selectedContactId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `contact_id=eq.${selectedContactId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.user_id === user.user_id) {
            setMessages((prev) => [...prev, newMsg as unknown as Message]);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `contact_id=eq.${selectedContactId}`,
        },
        (payload) => {
          const updated = payload.new as unknown as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedContactId, user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const renderMessages = () => {
    const elements: React.ReactNode[] = [];
    let lastDate: Date | null = null;

    messages.forEach((message) => {
      const msgDate = new Date(message.created_at);
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        elements.push(<ChatDateSeparator key={`date-${message.id}`} date={msgDate} />);
        lastDate = msgDate;
      }
      elements.push(<ChatBubble key={message.id} message={message} />);
    });

    return elements;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Monitorar Chat — {user?.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Contact list sidebar */}
          <div className="w-64 border-r flex flex-col shrink-0">
            <div className="p-2 border-b">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {contacts.length} contato{contacts.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ScrollArea className="flex-1">
              {isLoadingContacts ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum contato
                </div>
              ) : (
                contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContactId(contact.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-accent/50 transition-colors ${
                      selectedContactId === contact.id ? "bg-accent" : ""
                    }`}
                  >
                    <p className="font-medium text-sm truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                    {contact.lastMessageAt && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(contact.lastMessageAt), "dd/MM HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </button>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Messages area */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedContactId ? (
              <>
                {/* Chat header */}
                <div className="px-4 py-2 border-b bg-muted/30 shrink-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Eye className="h-3 w-3 mr-1" />
                      Somente leitura
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Monitoramento em tempo real
                    </span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto chat-wallpaper scrollbar-thin py-2 min-h-0">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <LoadingSpinner size="lg" text="Carregando mensagens..." />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mb-2 opacity-30" />
                      <p className="text-sm">Nenhuma mensagem nesta conversa</p>
                    </div>
                  ) : (
                    <>
                      {renderMessages()}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Eye className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Selecione um contato</p>
                <p className="text-sm">para monitorar as mensagens em tempo real</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}