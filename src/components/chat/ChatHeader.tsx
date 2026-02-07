import { Contact } from "@/types/juriszap";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Phone, FileText, ClipboardCopy, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";

interface ChatHeaderProps {
  contact: Contact;
  isMobile: boolean;
  onBack: () => void;
  onToggleBlock: (contactId: string, blocked: boolean) => void;
  isTogglingBlock?: boolean;
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

export function ChatHeader({ contact, isMobile, onBack, onToggleBlock, isTogglingBlock }: ChatHeaderProps) {
  const isBlocked = contact.status === "encerrado";

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

  return (
    <div className="flex items-center justify-between border-b bg-card px-3 md:px-5 py-2.5 md:py-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0 -ml-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
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
      </div>
      <div className="flex items-center gap-1">
        {isMobile ? (
          <>
            {blockButton}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyTemplate}
              className="text-muted-foreground"
            >
              <ClipboardCopy className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                {blockButton}
              </TooltipTrigger>
              <TooltipContent>{isBlocked ? "Desbloquear cliente" : "Bloquear cliente"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyTemplate}
                  className="text-muted-foreground"
                >
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
