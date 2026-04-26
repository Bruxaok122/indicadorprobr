import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatDateSeparator } from "@/components/chat/ChatDateSeparator";
import { isSameDay } from "date-fns";
import { Eye, User } from "lucide-react";

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

interface LiveChatViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  contactName?: string;
  contactPhone?: string;
  operatorName?: string;
}

export function LiveChatViewer({
  open,
  onOpenChange,
  contactId,
  contactName,
  contactPhone,
  operatorName,
}: LiveChatViewerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contactId || !open) {
      setMessages([]);
      return;
    }
    setLoading(true);
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
      setLoading(false);
    };
    fetchMessages();

    const channel = supabase
      .channel(`live-viewer-${contactId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `contact_id=eq.${contactId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `contact_id=eq.${contactId}` },
        (payload) =>
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? (payload.new as Message) : m)))
      )
      .subscribe();

    // Polling fallback every 5s
    const interval = setInterval(fetchMessages, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [contactId, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const grouped: Array<{ type: "date"; date: Date } | { type: "message"; message: Message }> = [];
  messages.forEach((msg, i) => {
    const d = new Date(msg.created_at);
    if (i === 0 || !isSameDay(d, new Date(messages[i - 1].created_at))) {
      grouped.push({ type: "date", date: d });
    }
    grouped.push({ type: "message", message: msg });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-primary" />
            <span className="truncate">{contactName || "Conversa"}</span>
            <Badge variant="outline" className="text-[10px] ml-1">AO VIVO</Badge>
          </DialogTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            {contactPhone && <span>{contactPhone}</span>}
            {operatorName && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {operatorName}
              </span>
            )}
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 p-4 chat-wallpaper">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <div className="space-y-1">
              {grouped.map((item, idx) =>
                item.type === "date" ? (
                  <ChatDateSeparator key={`d-${idx}`} date={item.date} />
                ) : (
                  <ChatBubble key={item.message.id} message={item.message as any} />
                )
              )}
              <div ref={endRef} />
            </div>
          )}
        </ScrollArea>
        <div className="border-t bg-muted/30 px-4 py-2 text-center shrink-0">
          <p className="text-xs text-muted-foreground">Somente leitura · Atualização em tempo real</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
