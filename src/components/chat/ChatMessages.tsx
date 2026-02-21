import { useEffect, useRef } from "react";
import { Message } from "@/types/juriszap";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send } from "lucide-react";
import { ChatBubble } from "./ChatBubble";
import { ChatDateSeparator } from "./ChatDateSeparator";
import { TypingIndicator } from "./TypingIndicator";
import { isSameDay } from "date-fns";
import { motion } from "framer-motion";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  templatesAvailable: boolean;
  onOpenTemplateDialog: () => void;
}

export function ChatMessages({
  messages,
  isLoading,
  isSending,
  templatesAvailable,
  onOpenTemplateDialog,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center chat-wallpaper">
        <LoadingSpinner size="lg" text="Carregando mensagens..." />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center chat-wallpaper">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 mb-5">
            <MessageSquare className="h-10 w-10 text-primary/50" />
          </div>
          <p className="text-lg font-semibold text-foreground/70">
            Nenhuma mensagem ainda
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Use um template aprovado para iniciar a conversa
          </p>
          <Button
            onClick={onOpenTemplateDialog}
            className="mt-5 rounded-xl shadow-md hover:shadow-lg transition-shadow"
            disabled={!templatesAvailable}
          >
            <Send className="mr-2 h-4 w-4" />
            Enviar Template
          </Button>
        </motion.div>
      </div>
    );
  }

  // Group messages by date
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
    <div className="flex-1 overflow-y-auto chat-wallpaper scrollbar-thin py-2 min-h-0 overscroll-contain">
      {renderMessages()}
      {isSending && <TypingIndicator className="px-2 md:px-4 mb-1" />}
      <div ref={messagesEndRef} />
    </div>
  );
}
