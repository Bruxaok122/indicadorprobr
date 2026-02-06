import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Paperclip, FileText } from "lucide-react";
import { toast } from "sonner";

interface ChatInputProps {
  messageText: string;
  setMessageText: (text: string) => void;
  canSendFreeText: boolean;
  hasMessages: boolean;
  isSending: boolean;
  isMobile: boolean;
  templatesAvailable: boolean;
  onSendMessage: () => void;
  onOpenTemplateDialog: () => void;
  onFileSelected: (file: File) => void;
}

export function ChatInput({
  messageText,
  setMessageText,
  canSendFreeText,
  hasMessages,
  isSending,
  isMobile,
  templatesAvailable,
  onSendMessage,
  onOpenTemplateDialog,
  onFileSelected,
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

  return (
    <div className={cn("border-t bg-card px-2 md:px-4 py-2", isMobile && "pb-5")}>
      {!canSendFreeText && hasMessages && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-warning/10 px-3 py-2">
          <p className="text-xs text-warning">
            Aguarde resposta do cliente ou use um template
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenTemplateDialog}
            className="h-7 text-xs"
          >
            <Send className="mr-1 h-3 w-3" />
            Template
          </Button>
        </div>
      )}
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
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="shrink-0 h-10 w-10 rounded-full text-muted-foreground">
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onOpenTemplateDialog} disabled={!templatesAvailable} className="shrink-0 h-10 w-10 rounded-full text-muted-foreground">
              <FileText className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="shrink-0 h-10 w-10 rounded-full text-muted-foreground">
                  <Paperclip className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enviar arquivo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onOpenTemplateDialog} disabled={!templatesAvailable} className="shrink-0 h-10 w-10 rounded-full text-muted-foreground">
                  <FileText className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enviar template</TooltipContent>
            </Tooltip>
          </>
        )}

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            placeholder="Mensagem"
            value={messageText}
            onChange={handleInput}
            onKeyDown={handleKeyPress}
            className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            rows={1}
            style={{ maxHeight: 120 }}
            disabled={!canSendFreeText}
          />
        </div>

        <Button
          onClick={onSendMessage}
          disabled={!messageText.trim() || isSending || !canSendFreeText}
          size="icon"
          className="shrink-0 h-10 w-10 rounded-full bg-primary hover:bg-primary/90"
        >
          {isSending ? (
            <LoadingSpinner size="sm" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
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
