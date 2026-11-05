import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Monitor, ShieldBan, ShieldCheck, LogOut, Shield } from "lucide-react";
import { AdminShell, AdminNavItem } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useAdminComputers } from "@/hooks/useAdminComputers";
import { useAuthContext } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

const ITEMS: AdminNavItem[] = [
  { value: "gestao", label: "Gestão", description: "Acessos administrativos", icon: Shield, group: "Sistema" },
  { value: "admin", label: "Painel administrativo", description: "", icon: ArrowLeft, group: "Sistema" },
];
function deviceLabel(info: Json): string {
  if (!info || typeof info !== "object" || Array.isArray(info)) return "Computador";
  return [info.browser, info.os].filter(v => typeof v === "string").join(" · ") || "Computador";
}

export default function GestaoPage() {
  const navigate = useNavigate();
  const { profile, signOut, session } = useAuthContext();
  const { data = [], isLoading, isError, refetch, action } = useAdminComputers();
  const [pending, setPending] = useState<{ id: string; action: "logout" | "block" | "unblock" } | null>(null);
  const sessionId = (() => {
    try { return session?.access_token ? JSON.parse(atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).session_id as string : null; }
    catch { return null; }
  })();
  const visible = data.filter(c => c.is_blocked || c.sessions.some(s => Date.now() - Date.parse(s.last_seen_at) < 120000));
  return (
    <AdminShell items={ITEMS} active="gestao" onChange={() => navigate("/administrador")} userName={profile?.full_name}
      onLogout={async () => { await signOut(); navigate("/login"); }} onRefresh={async () => { await refetch(); }}>
      <div className="mb-6 flex items-center gap-3 text-sm text-muted-foreground"><Monitor className="h-5 w-5 text-primary" />{visible.length} computadores</div>
      {isLoading ? <LoadingSpinner text="Carregando acessos..." /> : isError ? (
        <div className="py-8"><p className="mb-4 text-destructive">Não foi possível carregar os acessos.</p><Button onClick={() => void refetch()}>Tentar novamente</Button></div>
      ) : visible.length === 0 ? <p className="py-12 text-muted-foreground">Nenhum acesso administrativo ativo.</p> : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visible.map(computer => {
            const current = computer.sessions.some(s => s.id === sessionId);
            const lastSeen = computer.sessions.map(s => s.last_seen_at).sort().at(-1);
            return <section key={computer.id} className={cn("rounded-lg border border-border bg-card/60 p-5", computer.is_blocked && "border-destructive/40")}>
              <div className="flex items-start gap-3"><Monitor className="mt-1 h-6 w-6 shrink-0 text-primary" /><div className="min-w-0 flex-1">
                <h2 className="break-words font-semibold">{deviceLabel(computer.device_info)}</h2>
                <p className="break-all text-sm text-muted-foreground">{computer.profile?.full_name || "Administrador"} · {computer.profile?.email}</p>
                <div className="mt-3 flex flex-wrap gap-2"><Badge variant={computer.is_blocked ? "destructive" : "secondary"}>{computer.is_blocked ? "Bloqueado" : "Conectado"}</Badge>{current && <Badge variant="outline">Este computador</Badge>}</div>
                {lastSeen && <p className="mt-3 text-xs text-muted-foreground">Última atividade: {new Date(lastSeen).toLocaleString("pt-BR")}</p>}
              </div></div>
              <div className="mt-5 flex flex-wrap gap-2">
                {computer.is_blocked ? <Button variant="outline" disabled={action.isPending} onClick={() => setPending({ id: computer.id, action: "unblock" })}><ShieldCheck className="mr-2 h-4 w-4" />Desbloquear</Button> : <>
                  <Button variant="outline" disabled={action.isPending} onClick={() => setPending({ id: computer.id, action: "logout" })}><LogOut className="mr-2 h-4 w-4" />Deslogar</Button>
                  <Button variant="destructive" disabled={action.isPending} onClick={() => setPending({ id: computer.id, action: "block" })}><ShieldBan className="mr-2 h-4 w-4" />Bloquear computador</Button>
                </>}
              </div>
            </section>;
          })}
        </div>
      )}
      <AlertDialog open={!!pending} onOpenChange={open => { if (!open) setPending(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pending?.action === "block" ? "Bloquear este computador?" : pending?.action === "unblock" ? "Desbloquear este computador?" : "Encerrar este acesso?"}</AlertDialogTitle>
          <AlertDialogDescription>{pending?.action === "block" ? "O acesso será encerrado e este computador não poderá entrar novamente até ser desbloqueado. Se for este computador, você também sairá." : pending?.action === "unblock" ? "Este computador poderá fazer login novamente." : "Todas as sessões deste computador serão encerradas. Ele poderá fazer login novamente."}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => { if (pending) action.mutate(pending); }}>Confirmar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}