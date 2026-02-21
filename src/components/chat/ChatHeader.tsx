import { Contact } from "@/types/juriszap";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Phone, Lock, LockOpen, ArrowRightLeft, ClipboardCopy, Info } from "lucide-react";
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
  return `PARTE CONTRÁRIA: ${contact.lawyer_name || "—"}\n\nPROCESSO: ${contact.process_number || "—"}\n\n👤 Nome: ${contact.name}\n\n💳 Doc.: CPF: ${cpf}\n\n📞 Telefones: ${contact.phone}\n\n💰 Valor da Causa: R$ ${valor}\n\nDATA AGENDADA: \n\nDados bancários:\n\nCPF: ${cpf}\n\nCaixa Econômica\n\nAgência: \n\nConta: `;
}

const avatarColors = [
  "bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getStatusColor(status: string) {
  switch (status) {
    case "aguardando": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "respondido": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "encerrado": return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500";
    default: return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "aguardando": return "Aguardando";
    case "respondido": return "Respondido";
    case "encerrado": return "Encerrado";
    default: return "Novo";
  }
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

  const handleToggleBlock = () => onToggleBlock(contact.id, !isBlocked);

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

  const ActionBtn = ({ icon: Icon, label, onClick, disabled, className: c }: {
    icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean; className?: string;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={onClick} disabled={disabled}
          className={cn("h-8 w-8 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-all", c)}>
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 md:px-4 py-2 shrink-0"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 -ml-1 h-8 w-8 rounded-lg text-gray-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <button type="button" onClick={onOpenProfile}
          className="flex items-center gap-3 min-w-0 flex-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors -m-1 p-1.5 cursor-pointer active:scale-[0.99]"
        >
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
            getAvatarColor(contact.name)
          )}>
            {contact.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{contact.name}</h3>
              <span className={cn("hidden md:inline-flex rounded-full px-2 py-0 text-[10px] font-medium", getStatusColor(contact.status))}>
                {getStatusLabel(contact.status)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {contact.phone}
              </span>
            </div>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {!isAdmin && (
          <ActionBtn
            icon={isTransferring ? LoadingSpinner : ArrowRightLeft}
            label="Transferir" onClick={handleTransferToAdmin} disabled={isTransferring}
          />
        )}
        <ActionBtn
          icon={isBlocked ? LockOpen : Lock}
          label={isBlocked ? "Desbloquear" : "Bloquear"}
          onClick={handleToggleBlock} disabled={isTogglingBlock}
          className={isBlocked ? "text-green-500 hover:text-green-600" : "text-red-500 hover:text-red-600"}
        />
        <ActionBtn icon={ClipboardCopy} label="Copiar modelo" onClick={handleCopyTemplate} />
        <ActionBtn icon={Info} label="Perfil" onClick={() => onOpenProfile?.()} />
      </div>
    </motion.div>
  );
}
