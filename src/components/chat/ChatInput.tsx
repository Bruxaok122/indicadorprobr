import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Paperclip, FileText, Lock } from "lucide-react";
import { toast } from "sonner";
import { AudioRecorder } from "./AudioRecorder";
import { motion, AnimatePresence } from "framer-motion";

interface ChatInputProps {
  messageText: string;
  setMessageText: (text: string) => void;
  canSendFreeText: boolean;
  hasMessages: boolean;
  isSending: boolean;
  isMobile: boolean;
  templatesAvailable: boolean;
  isContactBlocked?: boolean;
  onSendMessage: () => void;
  onOpenTemplateDialog: () => void;
  onFileSelected: (file: File) => void;
  onSendAudio?: (blob: Blob) => void;
}

export function ChatInput({
  messageText, setMessageText, canSendFreeText, hasMessages, isSending, isMobile,
  templatesAvailable, isContactBlocked, onSendMessage, onOpenTemplateDialog, onFileSelected, onSendAudio,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      if (!isImage && !isPdf) { toast.error("Apenas PDF e imagens são permitidos"); return; }
      const maxSize = isImage ? 16 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) { toast.error(`Arquivo muito grande. Máximo ${isImage ? "16" : "10"}MB.`); return; }
      onFileSelected(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSendMessage(); }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    const el = e.target;
    // Avoid collapsing to "auto" which resets parent scroll position
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  if (isContactBlocked) {
    return (
      <div className={cn("bg-card dark:bg-card border-t border-violet/15 px-3 md:px-4 py-3", isMobile && "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>
        <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-3">
          <Lock className="h-4 w-4 text-red-500" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400">Cliente bloqueado — desbloqueie para enviar mensagens</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-muted/50 dark:bg-card border-t border-violet/15 px-2 md:px-3 py-2 shrink-0",
      isMobile && "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    )}>
      <AnimatePresence>
        {!canSendFreeText && hasMessages && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-2 flex items-center justify-between rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-3 py-2">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">Aguarde resposta do cliente ou use um template</p>
              <Button size="sm" variant="outline" onClick={onOpenTemplateDialog} className="h-7 text-xs rounded-lg border-yellow-300">
                <Send className="mr-1 h-3 w-3" /> Template
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-1.5">
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".pdf,application/pdf,image/*" className="hidden" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={!canSendFreeText}
              className="shrink-0 h-10 w-10 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800">
              <Paperclip className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Enviar arquivo</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onOpenTemplateDialog} disabled={!templatesAvailable}
              className="shrink-0 h-10 w-10 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800">
              <FileText className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Enviar template</TooltipContent>
        </Tooltip>

        {!messageText.trim() && onSendAudio && canSendFreeText && (
          <AudioRecorder onSendAudio={onSendAudio} isSending={isSending} />
        )}

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            placeholder={canSendFreeText ? "Digite uma mensagem..." : "Use um template para iniciar"}
            value={messageText}
            onChange={handleInput}
            onKeyDown={handleKeyPress}
            className="w-full resize-none rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-base md:text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 focus-visible:border-violet/50 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow scrollbar-none"
            rows={1}
            style={{ maxHeight: 120 }}
            disabled={!canSendFreeText}
          />
        </div>

        <AnimatePresence>
          {messageText.trim() && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <Button onClick={onSendMessage} disabled={!messageText.trim() || isSending || !canSendFreeText}
                size="icon" className="shrink-0 h-10 w-10 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-md">
                {isSending ? <LoadingSpinner size="sm" /> : <Send className="h-4 w-4" />}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isMobile && (
        <p className="mt-1 text-[11px] text-gray-400 px-12">
          {canSendFreeText ? "Enter para enviar · Shift + Enter para nova linha" : "Use um template para iniciar a conversa (política Meta)"}
        </p>
      )}
    </div>
  );
}
