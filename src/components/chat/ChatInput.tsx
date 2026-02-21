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
  messageText,
  setMessageText,
  canSendFreeText,
  hasMessages,
  isSending,
  isMobile,
  templatesAvailable,
  isContactBlocked,
  onSendMessage,
  onOpenTemplateDialog,
  onFileSelected,
  onSendAudio,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Apenas PDF e imagens são permitidos");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 10MB.");
        return;
      }
      onFileSelected(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  if (isContactBlocked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("border-t bg-card px-2 md:px-4 py-3", isMobile && "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}
      >
        <div className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 px-3 py-3">
          <Lock className="h-4 w-4 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            Cliente bloqueado — desbloqueie para enviar mensagens
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className={cn("border-t bg-card/80 backdrop-blur-sm px-2 md:px-4 py-2 shrink-0", isMobile && "pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>
      <AnimatePresence>
        {!canSendFreeText && hasMessages && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-2 flex items-center justify-between rounded-xl bg-warning/10 px-3 py-2">
              <p className="text-xs text-warning">
                Aguarde resposta do cliente ou use um template
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenTemplateDialog}
                className="h-7 text-xs rounded-lg"
              >
                <Send className="mr-1 h-3 w-3" />
                Template
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-1.5 md:gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".pdf,application/pdf,image/*"
          className="hidden"
        />

        {isMobile ? (
          <>
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={!canSendFreeText} className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground transition-colors">
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onOpenTemplateDialog} disabled={!templatesAvailable} className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground transition-colors">
              <FileText className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={!canSendFreeText} className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground transition-colors">
                  <Paperclip className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enviar arquivo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onOpenTemplateDialog} disabled={!templatesAvailable} className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground transition-colors">
                  <FileText className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enviar template</TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Audio recorder */}
        {!messageText.trim() && onSendAudio && canSendFreeText && (
          <AudioRecorder
            onSendAudio={onSendAudio}
            isSending={isSending}
          />
        )}

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            placeholder="Mensagem"
            value={messageText}
            onChange={handleInput}
            onKeyDown={handleKeyPress}
            className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow"
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
              <Button
                onClick={onSendMessage}
                disabled={!messageText.trim() || isSending || !canSendFreeText}
                size="icon"
                className="shrink-0 h-10 w-10 rounded-full bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-shadow"
              >
                {isSending ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!isMobile && (
        <p className="mt-1.5 text-[11px] text-muted-foreground px-12">
          {canSendFreeText
            ? "Enter para enviar · Shift + Enter para nova linha"
            : "Use um template para iniciar a conversa (política Meta)"}
        </p>
      )}
    </div>
  );
}
