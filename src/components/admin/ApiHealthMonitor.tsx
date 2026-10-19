import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useApiHealth } from "@/hooks/useApiHealth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Eye, Send, MessageSquare, AlertTriangle, ClipboardCheck, Phone, type LucideIcon } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Tone = "primary" | "success" | "warning" | "destructive";
const TONE: Record<Tone, string> = {
  primary: "text-primary bg-primary/10 ring-primary/20",
  success: "text-success bg-success/10 ring-success/20",
  warning: "text-warning bg-warning/10 ring-warning/20",
  destructive: "text-destructive bg-destructive/10 ring-destructive/20",
};

const rateTone = (rate: number): Tone => (rate >= 80 ? "success" : rate >= 60 ? "warning" : "destructive");

interface KpiProps { label: string; value: string; hint?: string; icon: LucideIcon; tone: Tone; index: number }

function Kpi({ label, value, hint, icon: Icon, tone, index }: KpiProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Card className="h-full">
        <CardContent className="p-4 flex items-start gap-3">
          <div className={cn("p-2 rounded-xl ring-1", TONE[tone])}><Icon className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold tracking-tight", TONE[tone].split(" ")[0])}>{value}</p>
            {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const QUALITY: Record<string, { tone: Tone; label: string }> = {
  GREEN: { tone: "success", label: "Alta" },
  YELLOW: { tone: "warning", label: "Média" },
  RED: { tone: "destructive", label: "Baixa" },
};

type Review = { checks: { id: string; label: string; status: "ok" | "warning" | "error"; detail: string }[]; summary: string; canDispatch: boolean };

export function ApiHealthMonitor() {
  const { data, deliveryRate, failureRate, responseRate, isLoading } = useApiHealth();
  const [isReviewing, setIsReviewing] = useState(false);
  const [review, setReview] = useState<Review | null>(null);

  const handleReview = async () => {
    setIsReviewing(true);
    setReview(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("pre-dispatch-review");
      if (error) throw error;
      setReview(res as Review);
      (res as Review).canDispatch ? toast.success("Tudo pronto para disparar") : toast.warning("Há pontos a corrigir");
    } catch (err) {
      toast.error("Erro na revisão: " + (err instanceof Error ? err.message : "tente novamente"));
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="lg" text="Carregando saúde da API..." /></div>;
  }

  if (!data.apiName) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma API ativa. Ative uma em APIs.</CardContent></Card>;
  }

  const since = data.since ? new Date(data.since).toLocaleDateString("pt-BR") : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            {data.apiName}
          </h2>
          <p className="text-xs text-muted-foreground">Somente dados desta API · desde {since}</p>
        </div>
        <Button onClick={handleReview} disabled={isReviewing} className="gap-2">
          {isReviewing ? <LoadingSpinner size="sm" /> : <ClipboardCheck className="h-4 w-4" />}
          {isReviewing ? "Revisando..." : "Revisão de Trabalho"}
        </Button>
      </div>

      {review && (
        <Card className={cn("ring-1", review.canDispatch ? "ring-success/30" : "ring-warning/30")}>
          <CardContent className="p-4 space-y-2">
            <p className={cn("text-sm font-medium", review.canDispatch ? "text-success" : "text-warning")}>{review.summary}</p>
            {review.checks.filter((c) => c.status !== "ok").map((c) => (
              <div key={c.id} className={cn("flex gap-2 p-2 rounded-lg text-xs", c.status === "warning" ? "bg-warning/10" : "bg-destructive/10")}>
                {c.status === "warning" ? <AlertTriangle className="h-4 w-4 text-warning shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                <div><p className="font-semibold">{c.label}</p><p className="text-muted-foreground">{c.detail}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi index={0} label="Enviadas" value={data.total.toLocaleString("pt-BR")} hint={`${data.templatesToday} templates hoje`} icon={Send} tone="primary" />
        <Kpi index={1} label="Entrega" value={`${deliveryRate}%`} hint={`${data.read.toLocaleString("pt-BR")} lidas`} icon={CheckCircle} tone={rateTone(deliveryRate)} />
        <Kpi index={2} label="Falhas" value={`${failureRate}%`} hint={`${data.failed.toLocaleString("pt-BR")} mensagens`} icon={XCircle} tone={failureRate >= 10 ? "destructive" : failureRate >= 5 ? "warning" : "success"} />
        <Kpi index={3} label="Respostas" value={`${responseRate}%`} hint={`${data.incoming.toLocaleString("pt-BR")} recebidas`} icon={MessageSquare} tone="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Últimos 7 dias</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.daily}>
                <defs>
                  <linearGradient id="gOk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="entregues" name="Entregues" stroke="hsl(var(--success))" fill="url(#gOk)" strokeWidth={2} />
                <Area type="monotone" dataKey="falhas" name="Falhas" stroke="hsl(var(--destructive))" fill="url(#gFail)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Números desta API</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.phones.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum número ativo</p>}
            {data.phones.map((p, i) => {
              const q = p.quality_rating ? QUALITY[p.quality_rating] : undefined;
              return (
                <motion.div key={p.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="p-3 rounded-xl border bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Phone className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.verified_name || p.display_phone_number}</p>
                        <p className="text-[11px] text-muted-foreground">{p.display_phone_number}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("border-0 ring-1", q ? TONE[q.tone] : "")}>{q?.label || "Sem dados"}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground"><Send className="h-3 w-3" />{p.sent}</span>
                    <span className="flex items-center gap-1 text-success"><Eye className="h-3 w-3" />{p.delivered + p.read}</span>
                    <span className="flex items-center gap-1 text-destructive"><XCircle className="h-3 w-3" />{p.failed}</span>
                    <span className={cn("ml-auto font-semibold", TONE[rateTone(p.successRate)].split(" ")[0])}>{p.successRate}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div className={cn("h-full rounded-full", p.successRate >= 80 ? "bg-success" : p.successRate >= 60 ? "bg-warning" : "bg-destructive")}
                      initial={{ width: 0 }} animate={{ width: `${p.successRate}%` }} transition={{ duration: 0.6 }} />
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
