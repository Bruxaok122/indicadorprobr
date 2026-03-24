import { useState } from "react";
import { Message } from "@/types/juriszap";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Check, CheckCheck, X, FileText, ZoomIn, Mic, Ban } from "lucide-react";
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

function getErrorLabel(errorCode?: string | null): string | null {
  if (!errorCode) return null;
  switch (errorCode) {
    case "131051": return "🚫 Cliente bloqueou você";
    case "131026": return "📵 Número sem WhatsApp";
    case "131049": return "⚠️ Limite de envio atingido";
    case "131047": return "⏰ Janela de 24h expirada";
    case "131021": return "⏰ Janela de 24h expirada";
    case "131053": return "📵 Número inválido";
    case "131031": return "❌ Conta desativada pelo cliente";
    case "130472": return "⏰ Janela de 24h expirada";
    case "131056": return "🔄 Mensagem não entregue (tente novamente)";
    case "131048": return "⚠️ Spam detectado pela Meta";
    case "368": return "⚠️ Conta temporariamente bloqueada pela Meta";
    default: return `❌ Erro ${errorCode}`;
  }
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isOutgoing = message.direction === "outgoing";
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const renderContent = () => {
    // Deleted message
    if (message.is_deleted) {
      return (
        <div className="flex items-center gap-1.5 opacity-60 italic">
          <Ban className="h-3.5 w-3.5" />
          <span className="text-sm">Mensagem apagada</span>
        </div>
      );
    }

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
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      );
    }
    if (message.message_type === "audio") {
      if (message.image_url) {
        return (
          <div className="flex items-center gap-1.5 py-0.5 min-w-[180px]">
            <Mic className="h-4 w-4 shrink-0 opacity-70" />
            <audio src={message.image_url} controls className="h-8 max-w-[220px]" style={{ minWidth: 0 }} />
          </div>
        );
      }
      return (
        <div className="flex items-center gap-1.5 py-0.5">
          <Mic className="h-4 w-4 shrink-0 opacity-70" />
          <span className="text-sm">{isOutgoing ? "Áudio enviado!" : "🎵 Áudio recebido"}</span>
        </div>
      );
    }
    if (message.message_type === "document") {
      return (
        <>
          <div className="mb-1 flex items-center gap-2 rounded-md bg-black/5 dark:bg-white/5 p-2">
            <FileText className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium truncate">{message.document_name || "Documento"}</span>
          </div>
          {message.content && <p className="whitespace-pre-wrap text-sm">{message.content}</p>}
        </>
      );
    }
    if (message.message_type === "template") {
      return (
        <div>
          <span className="mb-1 inline-block rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-60">Template</span>
          <p className="whitespace-pre-wrap text-sm">{message.content || message.template_name}</p>
        </div>
      );
    }
    const cleanContent = (message.content || "")
      .replace(/##STAGE:\S*?##\s*/g, "")
      .replace(/##BANK_DATA:\{.*?\}##\s*/g, "")
      .replace(/##VALUE_DETECTED:\S*?##\s*/g, "")
      .replace(/##NEW_OBJECTION:\w*##\s*/g, "")
      .replace(/##\S+?:\S*?##\s*/g, "")
      .replace(/##STAGE:\S*/g, "")
      .replace(/^##\s*/gm, "")
      .replace(/\s*##\s*/g, " ")
      .trim();
    if (!cleanContent) return null;
    return <p className="whitespace-pre-wrap text-sm leading-relaxed">{cleanContent}</p>;
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
          {message.status === "failed" && isOutgoing && (
            <div className="mt-1 rounded bg-red-50 dark:bg-red-900/20 px-2 py-1 text-[11px] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40">
              {getErrorLabel(message.error_code) || message.error_details || "Falha no envio"}
            </div>
          )}
        </div>
      </motion.div>

      {message.message_type === "image" && message.image_url && (
        <ImageLightbox src={message.image_url} alt="Imagem" open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}
