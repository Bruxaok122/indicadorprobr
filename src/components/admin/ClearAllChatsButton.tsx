import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BATCH = 100;

async function deleteInBatches<T extends { id: string }>(table: "messages" | "conversations" | "contacts", rows: T[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const ids = rows.slice(i, i + BATCH).map((r) => r.id);
    const { error } = await supabase.from(table).delete().in("id", ids);
    if (error) throw error;
  }
}

export function ClearAllChatsButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleClear = async () => {
    setBusy(true);
    try {
      // Page through all rows (Supabase 1000-row limit)
      const fetchAll = async (table: "messages" | "conversations" | "contacts") => {
        const all: { id: string }[] = [];
        let from = 0;
        const step = 1000;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await supabase.from(table).select("id").range(from, from + step - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < step) break;
          from += step;
        }
        return all;
      };

      const messages = await fetchAll("messages");
      await deleteInBatches("messages", messages);

      const conversations = await fetchAll("conversations");
      await deleteInBatches("conversations", conversations);

      const contacts = await fetchAll("contacts");
      await deleteInBatches("contacts", contacts);

      toast.success("Todos os chats foram limpos!", {
        description: `${messages.length} mensagens, ${conversations.length} conversas e ${contacts.length} contatos removidos.`,
      });
      setOpen(false);
    } catch (e: any) {
      toast.error("Erro ao limpar chats", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Trash2 className="h-4 w-4" />
        Limpar todos os chats
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar TODOS os chats?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente <strong>todos os contatos, conversas e mensagens</strong> de
              <strong> todos os operadores</strong>. Não pode ser desfeita. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                handleClear();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Limpando...</>
              ) : (
                <>Sim, limpar tudo</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
