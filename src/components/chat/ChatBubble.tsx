import { useState } from "react";
import { Message } from "@/types/juriszap";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock,
  Check,
  CheckCheck,
  X,
  FileText,
  ZoomIn,
  Mic,
} from "lucide-react";
import { ImageLightbox } from "./ImageLightbox";

interface ChatBubbleProps {
  message: Message;
}

function getStatusIcon(status: Message["status"]) {
  switch (status) {
    case "pending":
      return <Clock className="h-3 w-3" />;
    case "sent":
      return <Check className="h-3 w-3" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3" />;
    case "read":
      return <CheckCheck className="h-3 w-3 text-info" />;
    case "failed":
      return <X className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isOutgoing = message.direction === "outgoing";
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const renderContent = () => {
    if (message.message_type === "image" && message.image_url) {
      return (
        <div className="space-y-1">
          <div
            className="relative group cursor-pointer"
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={message.image_url}
              alt="Imagem recebida"
              className="max-w-full rounded-md max-h-64 object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors rounded-md">
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
      return (
        <div className="flex items-center gap-1.5 py-0.5">
          <Mic className="h-4 w-4 shrink-0 opacity-70" />
          <span className="text-sm">
            {message.direction === "outgoing" ? "Áudio enviado!" : "🎵 Áudio recebido"}
          </span>
        </div>
      );
    }

    if (message.message_type === "document") {
      return (
        <>
          <div className="mb-1.5 flex items-center gap-2 rounded-md bg-black/5 dark:bg-white/5 p-2">
            <FileText className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium truncate">
              {message.document_name || "Documento"}
            </span>
          </div>
          {message.content && (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          )}
        </>
      );
    }

    if (message.message_type === "template") {
      return (
        <div>
          <span className="mb-1 inline-block rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide opacity-70">
            Template
          </span>
          <p className="whitespace-pre-wrap text-sm">{message.content || message.template_name}</p>
        </div>
      );
    }

    return <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>;
  };

  return (
    <>
      <div className={cn("flex mb-1 px-2 md:px-4", isOutgoing ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "relative max-w-[85%] md:max-w-[65%] px-3 py-1.5 shadow-sm chat-selectable overflow-hidden break-words",
            isOutgoing
              ? "bubble-outgoing bg-chat-outgoing text-chat-outgoing-foreground"
              : "bubble-incoming bg-chat-incoming text-chat-incoming-foreground"
          )}
        >
          {renderContent()}
          <div className={cn(
            "flex items-center justify-end gap-1 mt-0.5 -mb-0.5",
            "text-[11px] text-chat-timestamp"
          )}>
            <span>
              {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
            </span>
            {isOutgoing && getStatusIcon(message.status)}
          </div>
        </div>
      </div>

      {message.message_type === "image" && message.image_url && (
        <ImageLightbox
          src={message.image_url}
          alt="Imagem recebida"
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
