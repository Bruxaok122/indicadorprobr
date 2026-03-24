import { useEffect, useRef, useLayoutEffect } from "react";
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
  onDeleteMessage?: (messageId: string) => void;
}

export function ChatMessages({ messages, isLoading, isSending, templatesAvailable, onOpenTemplateDialog, onDeleteMessage }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  // Instant scroll when conversation first loads (messages go from 0 to N)
  useLayoutEffect(() => {
    if (messages.length > 0 && prevMessageCount.current === 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  // Smooth scroll for new messages / sending indicator
  useEffect(() => {
    if (prevMessageCount.current > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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
        <motion.div animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 dark:bg-gray-800/80 shadow-md mb-4">
            <MessageSquare className="h-8 w-8 text-green-500/60" />
          </div>
          <p className="text-base font-semibold text-gray-600 dark:text-gray-300">Nenhuma mensagem ainda</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Use um template para iniciar a conversa</p>
          <Button onClick={onOpenTemplateDialog} className="mt-4 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-md" disabled={!templatesAvailable}>
            <Send className="mr-2 h-4 w-4" />
            Enviar Template
          </Button>
        </motion.div>
      </div>
    );
  }

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
      {isSending && <TypingIndicator className="px-3 md:px-4 mb-1" />}
      <div ref={messagesEndRef} />
    </div>
  );
}
