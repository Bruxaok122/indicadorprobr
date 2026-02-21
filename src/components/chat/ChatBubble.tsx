import { useState } from "react";
import { Message } from "@/types/juriszap";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Check, CheckCheck, X, FileText, ZoomIn, Mic } from "lucide-react";
import { ImageLightbox } from "./ImageLightbox";
import { motion } from "framer-motion";

interface ChatBubbleProps {
  message: Message;
}

function getStatusIcon(status: Message["status"]) {
  switch (status) {
    case "pending": return <Clock className="h-3 w-3 text-gray-400" />;
    case "sent": return <Check className="h-3 w-3 text-gray-400" />;
    case "delivered": return <CheckCheck className="h-3 w-3 text-gray-400" />;
    case "read": return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case "failed": return <X className="h-3 w-3 text-red-500" />;
    default: return null;
  }
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isOutgoing = message.direction === "outgoing";
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const renderContent = () => {
    if (message.message_type === "image" && message.image_url) {
      return (
        <div className="space-y-1">
          <div className="relative group cursor-pointer" onClick={() => setLightboxOpen(true)}>
            <img src={message.image_url} alt="Imagem" className="max-w-full rounded-md max-h-64 object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors rounded-md">
              <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          {message.content && message.content !== "[Imagem recebida]" && (
            <p className="text-[13px] whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      );
    }
    if (message.message_type === "audio") {
      return (
        <div className="flex items-center gap-1.5 py-0.5">
          <Mic className="h-4 w-4 shrink-0 opacity-70" />
          <span className="text-[13px]">{isOutgoing ? "Áudio enviado!" : "🎵 Áudio recebido"}</span>
        </div>
      );
    }
    if (message.message_type === "document") {
      return (
        <>
          <div className="mb-1 flex items-center gap-2 rounded-md bg-black/5 dark:bg-white/5 p-2">
            <FileText className="h-5 w-5 shrink-0" />
            <span className="text-[13px] font-medium truncate">{message.document_name || "Documento"}</span>
          </div>
          {message.content && <p className="whitespace-pre-wrap text-[13px]">{message.content}</p>}
        </>
      );
    }
    if (message.message_type === "template") {
      return (
        <div>
          <span className="mb-1 inline-block rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-60">Template</span>
          <p className="whitespace-pre-wrap text-[13px]">{message.content || message.template_name}</p>
        </div>
      );
    }
    return <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{message.content}</p>;
  };

  return (
    <>
      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className={cn("flex mb-0.5 px-3 md:px-4", isOutgoing ? "justify-end" : "justify-start")}
      >
        <div className={cn(
          "relative max-w-[85%] md:max-w-[65%] px-2.5 py-1.5 shadow-sm chat-selectable overflow-hidden break-words",
          isOutgoing
            ? "bubble-outgoing bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100"
            : "bubble-incoming bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100"
        )}>
          {renderContent()}
          <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span>{format(new Date(message.created_at), "HH:mm", { locale: ptBR })}</span>
            {isOutgoing && getStatusIcon(message.status)}
          </div>
        </div>
      </motion.div>

      {message.message_type === "image" && message.image_url && (
        <ImageLightbox src={message.image_url} alt="Imagem" open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}
