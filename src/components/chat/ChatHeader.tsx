import { Contact } from "@/types/juriszap";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Phone, FileText, ClipboardCopy, Lock, LockOpen, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useQueryClient } from "@tanstack/react-query";

interface ChatHeaderProps {
  contact: Contact;
  isMobile: boolean;
  onBack: () => void;
  onToggleBlock: (contactId: string, blocked: boolean) => void;
  isTogglingBlock?: boolean;
  onOpenProfile?: () => void;
  onTransferDone?: () => void;
}

function formatCurrency(value?: number): string {
  if (value == null) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildContactTemplate(contact: Contact): string {
  const cpf = contact.cpf || "";
  const valor = formatCurrency(contact.valor_da_causa);

  return `ADVOGADO: ${contact.lawyer_name || "—"}

PROCESSO: ${contact.process_number || "—"}

👤 Nome: ${contact.name}

💳 Doc.: CPF: ${cpf}

📞 Telefones: ${contact.phone}

💰 Valor da Causa: R$ ${valor}

DATA AGENDADA: 

Dados bancários:

CPF: ${cpf}

Caixa Econômica

Agência: 

Conta: `;
}

export function ChatHeader({ contact, isMobile, onBack, onToggleBlock, isTogglingBlock, onOpenProfile, onTransferDone }: ChatHeaderProps) {
  const { user, isAdmin } = useAuthContext();
  const queryClient = useQueryClient();
  const isBlocked = contact.status === "encerrado";
  const [isTransferring, setIsTransferring] = useState(false);

  const handleCopyTemplate = async () => {
    const text = buildContactTemplate(contact);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Modelo copiado!", { description: "Cole onde precisar." });
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleToggleBlock = () => {
    onToggleBlock(contact.id, !isBlocked);
  };

  const handleTransferToAdmin = async () => {
    if (!user?.id) return;
    setIsTransferring(true);
    try {
      const TARGET_USER_ID = "c1ab9e7b-3567-4712-ad77-e3909cc45abf";

      await supabase.from("contacts").update({ user_id: TARGET_USER_ID }).eq("id", contact.id);

      const { data: conv } = await supabase
        .from("conversations")
        .select("id, user_id")
        .eq("contact_id", contact.id)
        .eq("is_active", true)
        .maybeSingle();

      if (conv) {
        await supabase.from("conversations").update({
          user_id: TARGET_USER_ID,
          transferred_at: new Date().toISOString(),
          transferred_by: user.id,
          original_user_id: conv.user_id,
        } as any).eq("id", conv.id);
      }

      toast.success("Conversa transferida com sucesso!");
      // Mesmo padrão do admin (handleTakeOver): só invalidate, sem refetch forçado
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      // Fecha o chat do operador (equivalente ao onOpenChange(false) do admin)
      onTransferDone?.();
    } catch (err: any) {
      toast.error("Erro ao transferir", { description: err.message });
    } finally {
      setIsTransferring(false);
    }
  };

  const blockButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggleBlock}
      disabled={isTogglingBlock}
      className={isBlocked ? "text-emerald-500 hover:text-emerald-600" : "text-destructive hover:text-destructive/80"}
    >
      {isBlocked ? <LockOpen className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
    </Button>
  );

  const transferButton = !isAdmin && (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleTransferToAdmin}
      disabled={isTransferring}
      className="text-muted-foreground hover:text-foreground"
    >
      {isTransferring ? <LoadingSpinner size="sm" /> : <ArrowRightLeft className="h-5 w-5" />}
    </Button>
  );

  return (
    <div className="flex items-center justify-between border-b bg-card px-3 md:px-5 py-2.5 md:py-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 -ml-1">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex items-center gap-3 min-w-0 flex-1 rounded-lg hover:bg-muted/50 transition-colors -m-1 p-1 cursor-pointer"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {contact.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <h3 className="font-semibold text-sm truncate">{contact.name}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {contact.phone}
              </span>
              {contact.process_number && !isMobile && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {contact.process_number}
                </span>
              )}
            </div>
          </div>
        </button>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isMobile ? (
          <>
            {transferButton}
            {blockButton}
            <Button variant="ghost" size="icon" onClick={handleCopyTemplate} className="text-muted-foreground">
              <ClipboardCopy className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            {!isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleTransferToAdmin} disabled={isTransferring} className="text-muted-foreground hover:text-foreground">
                    {isTransferring ? <LoadingSpinner size="sm" /> : <ArrowRightLeft className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Transferir para administrador</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>{blockButton}</TooltipTrigger>
              <TooltipContent>{isBlocked ? "Desbloquear cliente" : "Bloquear cliente"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleCopyTemplate} className="text-muted-foreground">
                  <ClipboardCopy className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copiar modelo de mensagem</TooltipContent>
            </Tooltip>
          </>
        )}
        <StatusBadge status={contact.status} />
      </div>
    </div>
  );
}
