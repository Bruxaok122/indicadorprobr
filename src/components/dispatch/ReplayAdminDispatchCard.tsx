import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useDispatchContext, ActiveDispatch } from "@/contexts/DispatchContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Repeat, Send, List, FileText, Phone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { resilientDelay } from "@/lib/resilientDelay";

interface Snapshot {
  id: string;
  template_name: string;
  template_language: string;
  list_name: string;
  total: number;
  mode: string;
  phone_number_id: string | null;
  variable_mappings: Record<string, string>;
  phone_verified_name: string | null;
  min_income: number | null;
  batch_size: number | null;
  interval_seconds: number | null;
  turbo_limit: number | null;
  created_at: string;
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Card visible only to operators with `can_replay_admin_dispatch = true`.
 * Lets the operator re-run the last admin dispatch with their own credentials.
 */
export function ReplayAdminDispatchCard() {
  const { user, profile } = useAuthContext();
  const { addDispatch, updateDispatch, dispatchControlsRef } = useDispatchContext();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const canReplay = (profile as any)?.can_replay_admin_dispatch === true;

  useEffect(() => {
    if (!canReplay || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("last_admin_dispatch" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setSnapshot(data as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [canReplay, user?.id]);

  if (!canReplay || !snapshot || !user?.id) return null;

  const handleReplay = async () => {
    setConfirmOpen(false);
    setRunning(true);
    try {
      // Fetch contacts available in the pool for that list (respect operator filter)
      const query = supabase
        .from("contacts")
        .select("id")
        .eq("contact_list", snapshot.list_name)
        .or(`user_id.eq.${user.id},user_id.is.null`);
      if (typeof snapshot.min_income === "number") query.gte("valor_da_causa", snapshot.min_income);
      const limit = snapshot.mode === "turbo" ? snapshot.turbo_limit ?? snapshot.total : snapshot.total;
      if (limit) query.limit(limit);

      const { data: rows, error } = await query;
      if (error) throw error;
      const contactIds = (rows || []).map((r: any) => r.id);
      if (contactIds.length === 0) {
        toast.error("Nenhum contato disponível para repetir este disparo.", { duration: 8000 });
        setRunning(false);
        return;
      }

      const dispatchId = crypto.randomUUID();
      dispatchControlsRef.current[dispatchId] = { isPaused: false, isCancelled: false };

      const newDispatch: ActiveDispatch = {
        id: dispatchId,
        operatorName: profile?.full_name || "Operador",
        operatorId: user.id,
        templateName: snapshot.template_name,
        listName: snapshot.list_name,
        mode: snapshot.mode as any,
        total: contactIds.length,
        sent: 0,
        failed: 0,
        current: 0,
        isPaused: false,
        isCancelled: false,
        isFinished: false,
        errors: [],
      };
      addDispatch(newDispatch);

      const intervalSeconds = snapshot.interval_seconds ?? 65;
      const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] };

      (async () => {
        for (let i = 0; i < contactIds.length; i++) {
          const ctrl = dispatchControlsRef.current[dispatchId];
          if (ctrl?.isCancelled) break;
          while (ctrl?.isPaused && !ctrl?.isCancelled) {
            await new Promise((r) => setTimeout(r, 500));
          }
          if (ctrl?.isCancelled) break;

          const contactId = contactIds[i];
          const { data: result, error: sendError } = await supabase.functions.invoke(
            "send-bulk-template",
            {
              body: {
                contactIds: [contactId],
                templateName: snapshot.template_name,
                templateLanguage: snapshot.template_language,
                userId: user.id,
                assignedUserId: user.id,
                selectedPhoneNumberId: snapshot.phone_number_id || undefined,
                variableMappings: snapshot.variable_mappings || {},
                phoneVerifiedName: snapshot.phone_verified_name || undefined,
                dispatchMode: "private",
              },
            }
          );

          if (!sendError && result?.results) {
            results.sent += result.results.sent || 0;
            results.failed += result.results.failed || 0;
            if (result.results.errors) results.errors.push(...result.results.errors);
          } else {
            results.failed++;
            if (sendError) results.errors.push(sendError.message || "Erro no envio");
          }

          updateDispatch(dispatchId, {
            current: results.sent + results.failed + results.skipped,
            sent: results.sent,
            failed: results.failed,
            errors: [...results.errors],
          });

          // Anti-ban delay with jitter
          if (i < contactIds.length - 1 && !ctrl?.isCancelled) {
            const baseMs = Math.max(intervalSeconds * 1000, 3000);
            const jitter = Math.floor(baseMs * (0.05 + Math.random() * 0.2));
            await resilientDelay(baseMs + jitter, () => dispatchControlsRef.current[dispatchId]);
          }
        }
        updateDispatch(dispatchId, { isFinished: true });
      })();

      toast.success("🔁 Disparo iniciado com suas credenciais!");
    } catch (e: any) {
      toast.error("Erro ao repetir disparo", { description: e.message });
    } finally {
      setRunning(false);
    }
  };

  const modeLabel: Record<string, string> = {
    batch: "Lote",
    individual: "Individual",
    turbo: "Turbo",
    smart: "Inteligente",
  };

  return (
    <>
      <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-accent/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Repeat className="h-4 w-4 text-primary" />
            Repetir último disparo do admin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="truncate"><strong>Template:</strong> {snapshot.template_name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <List className="h-3 w-3 text-muted-foreground" />
              <span className="truncate"><strong>Lista:</strong> {snapshot.list_name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Send className="h-3 w-3 text-muted-foreground" />
              <span><strong>Quantidade:</strong> {snapshot.total}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">{modeLabel[snapshot.mode] || snapshot.mode}</Badge>
              {snapshot.phone_number_id && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  ...{snapshot.phone_number_id.slice(-4)}
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Disparo admin de {format(new Date(snapshot.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </p>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={running}
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            {running ? "Iniciando..." : "Disparar agora com minhas credenciais"}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Repetir disparo do admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai disparar <strong>{snapshot.template_name}</strong> para a lista <strong>{snapshot.list_name}</strong>
              {" "}(até {snapshot.total} contatos) usando suas credenciais e o número selecionado pelo admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReplay}>Confirmar e disparar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
