import { Contact } from "@/types/juriszap";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Phone,
  FileText,
  User,
  CreditCard,
  DollarSign,
  Calendar,
  Scale,
  Copy,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";

interface ContactProfileDrawerProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCurrency(value?: number): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ContactProfileDrawer({
  contact,
  open,
  onOpenChange,
}: ContactProfileDrawerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!contact) return null;

  const handleCopy = async (label: string, value: string) => {
    if (!value || value === "—") return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const infoItems = [
    { icon: Phone, label: "Telefone", value: contact.phone, copyable: true },
    { icon: FileText, label: "Nº do Processo", value: contact.process_number || "—", copyable: !!contact.process_number },
    { icon: Scale, label: "Parte Contrária", value: contact.lawyer_name || "—", copyable: !!contact.lawyer_name },
    { icon: CreditCard, label: "CPF", value: contact.cpf || "—", copyable: !!contact.cpf },
    { icon: DollarSign, label: "Valor da Causa", value: formatCurrency(contact.valor_da_causa), copyable: contact.valor_da_causa != null },
    {
      icon: Calendar, label: "Cadastrado em",
      value: format(new Date(contact.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
      copyable: false,
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[340px] sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>Perfil do contato</SheetTitle>
        </SheetHeader>

        {/* Profile hero */}
        <div className="flex flex-col items-center bg-primary/5 pt-10 pb-6 px-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground shadow-lg ring-4 ring-background">
            {contact.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="mt-4 text-xl font-semibold text-foreground text-center leading-tight">
            {contact.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{contact.phone}</p>
          <div className="mt-3">
            <StatusBadge status={contact.status} />
          </div>
        </div>

        {/* Info list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Informações do contato
          </p>
          <div className="space-y-1">
            {infoItems.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors group"
              >
                <item.icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium text-foreground break-all">
                    {item.value}
                  </p>
                </div>
                {item.copyable && (
                  <button
                    type="button"
                    onClick={() => handleCopy(item.label, item.value)}
                    className="shrink-0 mt-1 p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title={`Copiar ${item.label}`}
                  >
                    {copiedField === item.label ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {contact.last_message_at && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Última mensagem:{" "}
                <span className="font-medium text-foreground">
                  {format(
                    new Date(contact.last_message_at),
                    "dd/MM/yyyy 'às' HH:mm",
                    { locale: ptBR }
                  )}
                </span>
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
