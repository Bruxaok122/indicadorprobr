import { cn } from "@/lib/utils";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useApiHealth } from "@/hooks/useApiHealth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Phone,
  Users,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  Send,
  BarChart3,
  Heart,
  AlertTriangle,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = {
  delivered: "hsl(var(--success))",
  read: "hsl(var(--violet))",
  sent: "hsl(var(--info))",
  failed: "hsl(var(--destructive))",
  pending: "hsl(var(--warning))",
};

const STATUS_COLORS: Record<string, string> = {
  novo: "hsl(var(--info))",
  aguardando: "hsl(var(--warning))",
  respondido: "hsl(var(--success))",
  encerrado: "hsl(var(--destructive))",
};

function HealthScoreBadge({ score }: { score: number }) {
  let color = "bg-destructive text-destructive-foreground";
  let label = "Crítico";
  let Icon = XCircle;

  if (score >= 80) {
    color = "bg-success/15 text-success border-green-500/30";
    label = "Excelente";
    Icon = CheckCircle;
  } else if (score >= 60) {
    color = "bg-warning/15 text-warning border-yellow-500/30";
    label = "Regular";
    Icon = AlertTriangle;
  } else if (score >= 40) {
    color = "bg-orange-500/20 text-orange-400 border-orange-500/30";
    label = "Atenção";
    Icon = AlertTriangle;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${color}`}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-semibold">{score}%</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  color,
}: {
  title: string;
  value: string | number;
  icon: any;
  description?: string;
  trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-sm transition-colors hover:border-primary/40">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", TONES[color || "primary"])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        {trend === "up" && <TrendingUp className="mt-2 h-3 w-3 text-success" />}
        {trend === "down" && <TrendingDown className="mt-2 h-3 w-3 text-destructive" />}
      </CardContent>
    </Card>
  );
}

const TONES: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  info: "bg-info/15 text-info",
  success: "bg-success/15 text-success",
  violet: "bg-violet/15 text-violet",
  warning: "bg-warning/15 text-warning",
};

function QualityBadge({ rating }: { rating: string | null }) {
  if (!rating) return <Badge variant="outline" className="text-xs">Sem dados</Badge>;
  const map: Record<string, { color: string; label: string }> = {
    GREEN: { color: "bg-success/15 text-success", label: "Verde" },
    YELLOW: { color: "bg-warning/15 text-warning", label: "Amarelo" },
    RED: { color: "bg-destructive/15 text-destructive", label: "Vermelho" },
  };
  const info = map[rating] || { color: "bg-muted", label: rating };
  return <Badge className={`${info.color} text-xs border-0`}>{info.label}</Badge>;
}

export function ApiHealthMonitor() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeResults, setOptimizeResults] = useState<Record<string, number> | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResults, setReviewResults] = useState<{ checks: { id: string; label: string; status: "ok" | "warning" | "error"; detail: string }[]; summary: string; canDispatch: boolean } | null>(null);

  const {
    messageStats,
    dailyStats,
    phoneHealth,
    contactStats,
    incomingCount,
    templatesSentToday,
    deliveryRate,
    responseRate,
    isLoading,
  } = useApiHealth();

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setOptimizeResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("optimize-api-health");
      if (error) throw error;
      setOptimizeResults(data.results);
      toast.success(data.message);
    } catch (err: any) {
      toast.error("Erro ao otimizar: " + (err.message || "Tente novamente"));
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleReview = async () => {
    setIsReviewing(true);
    setReviewResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("pre-dispatch-review");
      if (error) throw error;
      setReviewResults(data);
      if (data.canDispatch) {
        toast.success("Revisão concluída: tudo pronto!");
      } else {
        toast.warning("Revisão concluída: há problemas a corrigir.");
      }
    } catch (err: any) {
      toast.error("Erro na revisão: " + (err.message || "Tente novamente"));
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Carregando métricas de saúde..." />
      </div>
    );
  }

  const pieData = messageStats
    ? [
        { name: "Entregues", value: messageStats.delivered, fill: COLORS.delivered },
        { name: "Lidas", value: messageStats.read, fill: COLORS.read },
        { name: "Enviadas", value: messageStats.sent, fill: COLORS.sent },
        { name: "Falhas", value: messageStats.failed, fill: COLORS.failed },
        { name: "Pendentes", value: messageStats.pending, fill: COLORS.pending },
      ].filter((d) => d.value > 0)
    : [];

  const contactPieData = contactStats
    ? [
        { name: "Novo", value: contactStats.novo, fill: STATUS_COLORS.novo },
        { name: "Aguardando", value: contactStats.aguardando, fill: STATUS_COLORS.aguardando },
        { name: "Respondido", value: contactStats.respondido, fill: STATUS_COLORS.respondido },
        { name: "Encerrado", value: contactStats.encerrado, fill: STATUS_COLORS.encerrado },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Saúde da API
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento em tempo real · Atualiza a cada 30s
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleReview}
            disabled={isReviewing}
            className="gap-2"
            variant="default"
          >
            {isReviewing ? (
              <LoadingSpinner size="sm" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {isReviewing ? "Revisando..." : "Revisão de Trabalho"}
          </Button>
          <Button
            onClick={handleOptimize}
            disabled={isOptimizing}
            className="gap-2"
            variant="outline"
          >
            {isOptimizing ? (
              <LoadingSpinner size="sm" />
            ) : (
              <ArrowUpRight className="h-4 w-4" />
            )}
            {isOptimizing ? "Otimizando..." : "Otimizar Score"}
          </Button>
          <HealthScoreBadge score={deliveryRate} />
        </div>
      </div>

      {/* Pre-Dispatch Review Results */}
      {reviewResults && (
        <Card className={reviewResults.canDispatch ? "rounded-2xl border-success/30 bg-success/5" : "rounded-2xl border-warning/30 bg-warning/5"}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {reviewResults.canDispatch ? (
                <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-3 w-full">
                <p className={`text-sm font-medium ${reviewResults.canDispatch ? "text-success" : "text-warning"}`}>
                  {reviewResults.summary}
                </p>
                <div className="space-y-2">
                  {reviewResults.checks.map((check) => (
                    <div
                      key={check.id}
                      className={`flex items-start gap-2 p-2 rounded-lg ${
                        check.status === "ok"
                          ? "bg-green-500/10"
                          : check.status === "warning"
                          ? "bg-yellow-500/10"
                          : "bg-red-500/10"
                      }`}
                    >
                      {check.status === "ok" ? (
                        <CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                      ) : check.status === "warning" ? (
                        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-xs font-semibold">{check.label}</p>
                        <p className="text-xs text-muted-foreground">{check.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optimization Results */}
      {optimizeResults && (
        <Card className="rounded-2xl border-success/30 bg-success/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <div className="space-y-2 w-full">
                <p className="text-sm font-medium text-success">Otimização concluída</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: "Pendentes limpos", value: optimizeResults.pending_cleaned },
                    { label: "Conversas fechadas", value: optimizeResults.conversations_closed },
                    { label: "Bloqueados encerrados", value: optimizeResults.blocked_contacts_closed },
                    { label: "Inválidos encerrados", value: optimizeResults.invalid_contacts_closed },
                    { label: "Inativos encerrados", value: optimizeResults.stale_contacts_closed },
                    { label: "Total msgs com falha", value: optimizeResults.total_failed_messages },
                  ].map((item) => (
                    <div key={item.label} className="bg-muted/30 border border-border/40 rounded-md p-2 text-center">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Enviadas"
          value={messageStats?.total.toLocaleString("pt-BR") || "0"}
          icon={Send}
          description="Todas as mensagens de saída"
          color="info"
        />
        <MetricCard
          title="Taxa de Entrega"
          value={`${deliveryRate}%`}
          icon={CheckCircle}
          description={`${((messageStats?.delivered || 0) + (messageStats?.read || 0)).toLocaleString("pt-BR")} entregues + lidas`}
          color="success"
        />
        <MetricCard
          title="Taxa de Resposta"
          value={`${responseRate}%`}
          icon={MessageSquare}
          description={`${incomingCount.toLocaleString("pt-BR")} respostas recebidas`}
          color="violet"
        />
        <MetricCard
          title="Templates Hoje"
          value={templatesSentToday.toLocaleString("pt-BR")}
          icon={Zap}
          description="Disparados no dia"
          color="warning"
        />
      </div>

      {/* Status Breakdown + Chart Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Message Status Breakdown */}
        <Card className="rounded-2xl border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Status das Mensagens
            </CardTitle>
            <CardDescription>Distribuição por status de entrega</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Enviadas", value: messageStats?.sent || 0, icon: Send, color: "text-info" },
                { label: "Entregues", value: messageStats?.delivered || 0, icon: CheckCircle, color: "text-success" },
                { label: "Lidas", value: messageStats?.read || 0, icon: Eye, color: "text-primary" },
                { label: "Falharam", value: messageStats?.failed || 0, icon: XCircle, color: "text-destructive" },
                { label: "Pendentes", value: messageStats?.pending || 0, icon: Clock, color: "text-warning" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-bold">{item.value.toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
            {pieData.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3} stroke="hsl(var(--card))" strokeWidth={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number) => [value.toLocaleString("pt-BR"), ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Daily Bar Chart */}
        <Card className="rounded-2xl border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Últimos 7 Dias
            </CardTitle>
            <CardDescription>Volume diário de envios</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyStats}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis axisLine={false} tickLine={false} width={32} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="delivered" name="Entregues" fill={COLORS.delivered} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sent" name="Enviadas" fill={COLORS.sent} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Falhas" fill={COLORS.failed} radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                Sem dados dos últimos 7 dias
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Phone Health + Contact Stats */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Phone Numbers Health */}
        <Card className="rounded-2xl border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Saúde dos Números
            </CardTitle>
            <CardDescription>Status e qualidade de cada número de disparo</CardDescription>
          </CardHeader>
          <CardContent>
            {phoneHealth.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum número ativo
              </div>
            ) : (
              <div className="space-y-3">
                {phoneHealth.map((phone) => (
                  <div
                    key={phone.id}
                    className="p-4 rounded-xl border border-border/50 bg-background/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {phone.verified_name || phone.display_phone_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {phone.display_phone_number}
                        </p>
                      </div>
                      <QualityBadge rating={phone.quality_rating} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/30 border border-border/40 rounded-md p-1.5">
                        <p className="text-xs text-muted-foreground">Disparados</p>
                        <p className="text-sm font-bold">{phone.totalSent}</p>
                      </div>
                      <div className="bg-muted/30 border border-border/40 rounded-md p-1.5">
                        <p className="text-xs text-muted-foreground">Entregues</p>
                        <p className="text-sm font-bold text-success">{phone.totalDelivered}</p>
                      </div>
                      <div className="bg-muted/30 border border-border/40 rounded-md p-1.5">
                        <p className="text-xs text-muted-foreground">Lidas</p>
                        <p className="text-sm font-bold text-primary">{phone.totalRead}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Status */}
        <Card className="rounded-2xl border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Status dos Contatos
            </CardTitle>
            <CardDescription>
              {contactStats?.total.toLocaleString("pt-BR") || 0} contatos no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Novos", value: contactStats?.novo || 0, color: "text-info" },
                { label: "Aguardando", value: contactStats?.aguardando || 0, color: "text-warning" },
                { label: "Respondidos", value: contactStats?.respondido || 0, color: "text-success" },
                { label: "Encerrados", value: contactStats?.encerrado || 0, color: "text-destructive" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className={`text-sm font-bold ${item.color}`}>{item.value.toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40 mb-3">
              <span className="text-xs text-muted-foreground">Com responsável</span>
              <span className="text-sm font-bold">{contactStats?.withUser.toLocaleString("pt-BR") || 0}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40 mb-4">
              <span className="text-xs text-muted-foreground">Sem responsável (pool)</span>
              <span className="text-sm font-bold">{contactStats?.withoutUser.toLocaleString("pt-BR") || 0}</span>
            </div>

            {contactPieData.length > 0 && (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={contactPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    paddingAngle={3} stroke="hsl(var(--card))" strokeWidth={2}
                    dataKey="value"
                  >
                    {contactPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number) => [value.toLocaleString("pt-BR"), ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Health Tips */}
      {deliveryRate < 60 && (
        <Card className="rounded-2xl border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-warning">Taxa de entrega baixa</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Reduza o volume diário de disparos para recuperar a reputação</li>
                  <li>Remova contatos com números inválidos da base</li>
                  <li>Use templates mais personalizados e engajadores</li>
                  <li>Verifique o Quality Rating dos números no Meta Business Suite</li>
                  <li>Alterne entre números de disparo para distribuir volume</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
