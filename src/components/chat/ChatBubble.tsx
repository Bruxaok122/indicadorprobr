import { useState } from "react";
import { Message } from "@/types/juriszap";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Check, CheckCheck, X, FileText, ZoomIn, Mic, Ban, Trash2, SmilePlus, Plus } from "lucide-react";
import { ImageLightbox } from "./ImageLightbox";
import { EmojiPicker } from "./EmojiPicker";
import { motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface ChatBubbleProps {
  message: Message;
  reactions?: Message[];
  onDeleteMessage?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

const DEFAULT_QUICK_EMOJIS = ["👍", "🆗", "❤️", "😂", "😮", "😢", "🙏", "🔥"];
const RECENT_KEY = "juriszap_recent_reactions";
const MAX_RECENT = 8;

function getRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

function pushRecentEmoji(emoji: string) {
  try {
    const current = getRecentEmojis().filter((e) => e !== emoji);
    const next = [emoji, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
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

export function ChatBubble({ message, reactions, onDeleteMessage, onReact }: ChatBubbleProps) {
  const isOutgoing = message.direction === "outgoing";
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const canDelete = isOutgoing && !message.is_deleted;

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

    if (message.message_type === "sticker") {
      if (message.image_url) {
        return (
          <img
            src={message.image_url}
            alt="Figurinha"
            className="max-w-[160px] max-h-[160px] object-contain bg-transparent"
          />
        );
      }
      return <p className="text-sm italic opacity-70">[Figurinha]</p>;
    }

    if (message.message_type === "reaction") {
      const raw = message.content || "";
      const match = raw.match(/^(.+?)\s*→\s*"(.*)"$/);
      const emoji = match ? match[1] : raw;
      const ref = match ? match[2] : "";
      return (
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-2xl leading-none">{emoji}</span>
          {ref && (
            <span className="text-xs opacity-60 italic max-w-[200px] truncate">
              "{ref}"
            </span>
          )}
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

  // Aggregate reactions: deduplicate per user_id (latest wins) and skip empty (removed)
  const reactionEmojis = (() => {
    if (!reactions || reactions.length === 0) return [] as { emoji: string; outgoing: boolean }[];
    const byKey = new Map<string, { emoji: string; outgoing: boolean; created_at: string }>();
    for (const r of reactions) {
      const key = (r.direction === "outgoing" ? "out" : "in") + ":" + ((r as any).user_id || r.contact_id);
      const prev = byKey.get(key);
      if (!prev || new Date(r.created_at) > new Date(prev.created_at)) {
        byKey.set(key, { emoji: (r.content || "").trim(), outgoing: r.direction === "outgoing", created_at: r.created_at });
      }
    }
    return Array.from(byKey.values()).filter((r) => r.emoji);
  })();

  return (
    <>
      <div className={cn("flex mb-0.5 px-3 md:px-4 group", isOutgoing ? "justify-end" : "justify-start")}>
        <div className="relative inline-block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!canDelete}>
              <motion.div
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={cn(canDelete && "cursor-context-menu")}
              >
                <div className={cn(
                  "relative max-w-[85vw] md:max-w-[480px] px-2.5 py-1.5 shadow-sm chat-selectable overflow-hidden break-words",
                  isOutgoing
                    ? "bubble-outgoing bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100"
                    : "bubble-incoming bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100",
                  reactionEmojis.length > 0 && "mb-5"
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
            </DropdownMenuTrigger>
            {canDelete && (
              <DropdownMenuContent side="left" align="start" className="min-w-[160px]">
                <DropdownMenuItem
                  onClick={() => onDeleteMessage?.(message.id)}
                  className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Apagar para todos
                </DropdownMenuItem>
              </DropdownMenuContent>
            )}
          </DropdownMenu>

          {/* Emoji react button — only on incoming bubbles */}
          {!isOutgoing && onReact && !message.is_deleted && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -right-7 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow"
                >
                  <SmilePlus className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-auto p-1.5">
                <QuickReactRow messageId={message.id} onReact={onReact} />
              </PopoverContent>
            </Popover>
          )}

          {/* Reaction chips — pinned bottom-right of bubble (WhatsApp style) */}
          {reactionEmojis.length > 0 && (
            <div className={cn(
              "absolute -bottom-3 flex gap-0.5 rounded-full bg-white dark:bg-[#2a3942] px-1.5 py-0.5 shadow border border-gray-200 dark:border-gray-700 text-sm leading-none z-10",
              isOutgoing ? "right-2" : "left-2"
            )}>
              {reactionEmojis.map((r, i) => (
                <span key={i}>{r.emoji}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {message.message_type === "image" && message.image_url && (
        <ImageLightbox src={message.image_url} alt="Imagem" open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}

function QuickReactRow({ messageId, onReact }: { messageId: string; onReact: (id: string, e: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  // Merge recent + defaults, recent first, deduped, capped at MAX_RECENT
  const emojis = (() => {
    const recent = getRecentEmojis();
    const merged: string[] = [];
    for (const e of [...recent, ...DEFAULT_QUICK_EMOJIS]) {
      if (!merged.includes(e)) merged.push(e);
      if (merged.length >= MAX_RECENT) break;
    }
    return merged;
  })();

  const handleSelect = (e: string) => {
    pushRecentEmoji(e);
    onReact(messageId, e);
  };

  if (expanded) {
    return <EmojiPicker onSelect={handleSelect} />;
  }
  return (
    <div className="flex items-center gap-1">
      {emojis.map((e) => (
        <button
          key={e}
          onClick={() => handleSelect(e)}
          className="text-xl hover:scale-125 transition-transform px-1"
        >
          {e}
        </button>
      ))}
      <button
        onClick={() => setExpanded(true)}
        className="ml-1 h-7 w-7 flex items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"
        title="Mais emojis"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
