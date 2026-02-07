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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  if (!contact) return null;

  const infoItems = [
    {
      icon: Phone,
      label: "Telefone",
      value: contact.phone,
    },
    {
      icon: FileText,
      label: "Nº do Processo",
      value: contact.process_number || "—",
    },
    {
      icon: Scale,
      label: "Advogado",
      value: contact.lawyer_name || "—",
    },
    {
      icon: CreditCard,
      label: "CPF",
      value: contact.cpf || "—",
    },
    {
      icon: DollarSign,
      label: "Valor da Causa",
      value: formatCurrency(contact.valor_da_causa),
    },
    {
      icon: Calendar,
      label: "Cadastrado em",
      value: format(new Date(contact.created_at), "dd 'de' MMMM 'de' yyyy", {
        locale: ptBR,
      }),
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
                className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors"
              >
                <item.icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium text-foreground break-all">
                    {item.value}
                  </p>
                </div>
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
