import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Contact, Profile } from "@/types/juriszap";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatDateSeparator } from "@/components/chat/ChatDateSeparator";
import { Input } from "@/components/ui/input";
import { isSameDay } from "date-fns";
import { MessageSquare, Search, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string | null;
  direction: string;
  message_type: string;
  created_at: string;
  status: string | null;
  image_url?: string | null;
  document_url?: string | null;
  document_name?: string | null;
  user_id?: string | null;
  contact_id: string;
  conversation_id: string;
}

interface AdminChatMonitorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile | null;
}

export function AdminChatMonitor({ open, onOpenChange, user }: AdminChatMonitorProps) {
  const { user: adminUser } = useAuthContext();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [isTakingOver, setIsTakingOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["admin-monitor-contacts", user?.user_id],
    queryFn: async () => {
      if (!user?.user_id) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.user_id)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!user?.user_id && open,
  });

  useEffect(() => {
    if (!selectedContactId) { setMessages([]); return; }
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages").select("*").eq("contact_id", selectedContactId)
        .order("created_at", { ascending: true });
      if (!error && data) setMessages(data as Message[]);
    };
    fetchMessages();
    const channel = supabase
      .channel(`admin-monitor-${selectedContactId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `contact_id=eq.${selectedContactId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `contact_id=eq.${selectedContactId}` },
        (payload) => setMessages((prev) => prev.map((m) => m.id === payload.new.id ? payload.new as Message : m)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedContactId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (!open) { setSelectedContactId(null); setMessages([]); setSearch(""); } }, [open]);

  const handleTakeOver = async () => {
    if (!selectedContactId || !adminUser?.id) return;
    setIsTakingOver(true);
    try {
      await supabase.from("contacts").update({ user_id: adminUser.id }).eq("id", selectedContactId);
      const { data: conv } = await supabase.from("conversations").select("id, user_id")
        .eq("contact_id", selectedContactId).eq("is_active", true).maybeSingle();
      if (conv) {
        await supabase.from("conversations").update({
          user_id: adminUser.id,
          transferred_at: new Date().toISOString(),
          transferred_by: adminUser.id,
          original_user_id: conv.user_id,
        } as any).eq("id", conv.id);
      }
      toast.success("Conversa assumida! O contato foi transferido para você.");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-monitor-contacts"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao assumir conversa", { description: err.message });
    } finally { setIsTakingOver(false); }
  };

  const filteredContacts = contacts.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });
  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  const groupedMessages: Array<{ type: "date"; date: Date } | { type: "message"; message: Message }> = [];
  messages.forEach((msg, i) => {
    const msgDate = new Date(msg.created_at);
    if (i === 0 || !isSameDay(msgDate, new Date(messages[i - 1].created_at))) {
      groupedMessages.push({ type: "date", date: msgDate });
    }
    groupedMessages.push({ type: "message", message: msg });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            Monitor de Chat — {user?.full_name}
            <Badge variant="outline" className="text-xs ml-1">Tempo real</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-1 min-h-0">
          <div className="w-72 border-r flex flex-col shrink-0">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 h-8 text-sm" />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {contactsLoading ? (
                <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
              ) : filteredContacts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sem contatos</p>
              ) : filteredContacts.map((contact) => (
                <button key={contact.id} onClick={() => setSelectedContactId(contact.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-border/50 hover:bg-muted/50 transition-colors ${selectedContactId === contact.id ? "bg-muted" : ""}`}>
                  <div className="h-8 w-8 shrink-0 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                  </div>
                </button>
              ))}
            </ScrollArea>
          </div>
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {selectedContact ? (
              <>
                <div className="px-4 py-2.5 border-b flex items-center justify-between shrink-0 bg-card">
                  <div>
                    <p className="font-semibold text-sm">{selectedContact.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
                  </div>
                  <Button size="sm" variant="destructive" onClick={handleTakeOver} disabled={isTakingOver} className="gap-1.5">
                    {isTakingOver ? <LoadingSpinner size="sm" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                    Assumir Conversa
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-4 chat-wallpaper">
                  <div className="space-y-1">
                    {groupedMessages.map((item, idx) =>
                      item.type === "date" ? (
                        <ChatDateSeparator key={`date-${idx}`} date={item.date} />
                      ) : (
                        <ChatBubble key={item.message.id} message={item.message as any} />
                      )
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="border-t bg-muted/30 px-4 py-2 text-center shrink-0">
                  <p className="text-xs text-muted-foreground">Somente leitura · Monitoramento em tempo real</p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground chat-wallpaper">
                <MessageSquare className="h-10 w-10 opacity-30" />
                <p className="text-sm">Selecione um contato para monitorar</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
