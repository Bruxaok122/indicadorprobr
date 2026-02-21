import { Contact } from "@/types/juriszap";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Phone, FileText, ClipboardCopy, Lock, LockOpen, ArrowRightLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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

  return `PARTE CONTRÁRIA: ${contact.lawyer_name || "—"}

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

// Generate a consistent color from a name
function getAvatarColor(name: string): string {
  const colors = [
    "from-blue-500 to-blue-600",
    "from-emerald-500 to-emerald-600",
    "from-violet-500 to-violet-600",
    "from-amber-500 to-amber-600",
    "from-rose-500 to-rose-600",
    "from-cyan-500 to-cyan-600",
    "from-indigo-500 to-indigo-600",
    "from-teal-500 to-teal-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
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
      const { data, error } = await supabase.functions.invoke("transfer-conversation", {
        body: { contactId: contact.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Conversa transferida com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onTransferDone?.();
    } catch (err: any) {
      toast.error("Erro ao transferir", { description: err.message });
    } finally {
      setIsTransferring(false);
    }
  };

  const ActionButton = ({ icon: Icon, label, onClick, disabled, className: btnClass }: {
    icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean; className?: string;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          className={cn("h-9 w-9 rounded-xl transition-all hover:scale-105", btnClass)}
        >
          <Icon className="h-4.5 w-4.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-between border-b bg-card/80 backdrop-blur-sm px-3 md:px-5 py-2.5 md:py-3 shrink-0"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 -ml-1 h-9 w-9 rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex items-center gap-3 min-w-0 flex-1 rounded-xl hover:bg-muted/50 transition-all -m-1 p-1.5 cursor-pointer active:scale-[0.98]"
        >
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-sm",
            getAvatarColor(contact.name)
          )}>
            {contact.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{contact.name}</h3>
              <StatusBadge status={contact.status} className="text-[10px] px-1.5 py-0 hidden md:inline-flex" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {contact.phone}
              </span>
              {contact.process_number && !isMobile && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span className="truncate max-w-[120px]">{contact.process_number}</span>
                </span>
              )}
            </div>
          </div>
        </button>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {!isAdmin && (
          <ActionButton
            icon={isTransferring ? LoadingSpinner : ArrowRightLeft}
            label="Transferir para administrador"
            onClick={handleTransferToAdmin}
            disabled={isTransferring}
            className="text-muted-foreground hover:text-foreground"
          />
        )}
        <ActionButton
          icon={isBlocked ? LockOpen : Lock}
          label={isBlocked ? "Desbloquear cliente" : "Bloquear cliente"}
          onClick={handleToggleBlock}
          disabled={isTogglingBlock}
          className={isBlocked ? "text-emerald-500 hover:text-emerald-600" : "text-destructive hover:text-destructive/80"}
        />
        <ActionButton
          icon={ClipboardCopy}
          label="Copiar modelo de mensagem"
          onClick={handleCopyTemplate}
          className="text-muted-foreground hover:text-foreground"
        />
        <ActionButton
          icon={Info}
          label="Ver perfil do contato"
          onClick={() => onOpenProfile?.()}
          className="text-muted-foreground hover:text-foreground"
        />
      </div>
    </motion.div>
  );
}
