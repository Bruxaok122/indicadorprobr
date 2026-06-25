import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, SkipForward, X, Loader2, Check, User, Phone, FileText } from "lucide-react";

export interface ManualContact {
  id: string;
  name?: string | null;
  phone?: string | null;
  process_number?: string | null;
  cpf?: string | null;
  valor_da_causa?: number | null;
  lawyer_name?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ManualContact[];
  template: { name: string; language: string };
  variableMappings: Record<string, string>;
  phoneNumberId?: string;
  phoneVerifiedName?: string;
  userId: string;
  assignedUserId?: string;
  shared?: boolean;
  onFinished?: (summary: { sent: number; skipped: number; failed: number }) => void;
}

export function ManualDispatchDialog({
  open,
  onOpenChange,
  contacts,
  template,
  variableMappings,
  phoneNumberId,
  phoneVerifiedName,
  userId,
  assignedUserId,
  shared,
  onFinished,
}: Props) {
  const [index, setIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [counts, setCounts] = useState({ sent: 0, skipped: 0, failed: 0 });
  const total = contacts.length;
  const current = contacts[index];
  const done = index >= total;

  useEffect(() => {
    if (open) {
      setIndex(0);
      setCounts({ sent: 0, skipped: 0, failed: 0 });
    }
  }, [open]);

  const advance = () => setIndex((i) => i + 1);

  const handleSend = async () => {
    if (!current || sending) return;
    setSending(true);
    try {
      const { data: check } = await supabase
        .from("contacts")
        .select("id, user_id")
        .eq("id", current.id)
        .maybeSingle();
      if (!check || (check as any).user_id !== null) {
        toast.warning("Contato não está mais no pool. Pulando.");
        setCounts((c) => ({ ...c, skipped: c.skipped + 1 }));
        advance();
        return;
      }

      const { data: result, error } = await supabase.functions.invoke("send-bulk-template", {
        body: {
          contactIds: [current.id],
          templateName: template.name,
          templateLanguage: template.language,
          userId,
          assignedUserId: shared ? undefined : assignedUserId,
          selectedPhoneNumberId: phoneNumberId || undefined,
          variableMappings,
          phoneVerifiedName,
          dispatchMode: shared ? "shared" : "private",
        },
      });

      if (error || !result?.results || (result.results.failed > 0 && (result.results.sent || 0) === 0)) {
        const errMsg = (result?.results?.errors?.[0] as string) || error?.message || "Falha no envio";
        toast.error(`❌ ${errMsg}`, { duration: 8000 });
        setCounts((c) => ({ ...c, failed: c.failed + 1 }));
      } else {
        toast.success(`✅ Enviado para ${current.name || current.phone}`);
        setCounts((c) => ({ ...c, sent: c.sent + 1 }));
      }
      advance();
    } finally {
      setSending(false);
    }
  };

  const handleSkip = () => {
    if (sending) return;
    setCounts((c) => ({ ...c, skipped: c.skipped + 1 }));
    advance();
  };

  const handleClose = () => {
    onFinished?.(counts);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Disparo Manual — {done ? "Finalizado" : `${index + 1} / ${total}`}
          </DialogTitle>
          <DialogDescription>
            Revise cada contato antes de enviar. Você pode pular qualquer um.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 text-xs">
          <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            <Check className="h-3 w-3 mr-1" /> {counts.sent} enviados
          </Badge>
          <Badge variant="secondary">
            <SkipForward className="h-3 w-3 mr-1" /> {counts.skipped} pulados
          </Badge>
          <Badge variant="destructive" className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30">
            <X className="h-3 w-3 mr-1" /> {counts.failed} falhas
          </Badge>
        </div>

        {done ? (
          <div className="rounded-lg border border-border p-6 text-center space-y-2">
            <Check className="h-8 w-8 mx-auto text-emerald-500" />
            <p className="font-semibold">Disparo manual concluído</p>
            <p className="text-xs text-muted-foreground">
              {counts.sent} enviados, {counts.skipped} pulados, {counts.failed} com erro
            </p>
            <Button onClick={handleClose} className="mt-2">Fechar</Button>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium truncate">{current?.name || "Sem nome"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span>{current?.phone || "—"}</span>
              </div>
              {current?.process_number && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="truncate">{current.process_number}</span>
                </div>
              )}
              {current?.valor_da_causa != null && (
                <div className="text-[11px] text-muted-foreground">
                  Valor da causa: R$ {Number(current.valor_da_causa).toLocaleString("pt-BR")}
                </div>
              )}
              <div className="pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                Template: <span className="font-medium text-foreground">{template.name}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSkip} disabled={sending} className="flex-1">
                <SkipForward className="h-4 w-4 mr-1" /> Pular
              </Button>
              <Button onClick={handleSend} disabled={sending} className="flex-1">
                {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Enviar
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs text-muted-foreground">
              Encerrar disparo manual
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
