import { useMemo, useState } from "react";
import { useRealtimeMonitor, type ActiveChatRow, type OperatorActivity } from "@/hooks/useRealtimeMonitor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LiveChatViewer } from "./LiveChatViewer";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Activity, Users, MessageCircle, ArrowDownToLine, ArrowUpFromLine,
  AlertCircle, Eye, Search, Bot, Clock, Circle, AlertTriangle, BellRing,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function StatCard({
  icon: Icon, label, value, hint, tone = "default",
}: {
  icon: any; label: string; value: string | number; hint?: string;
  tone?: "default" | "success" | "warning" | "info";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    success: "text-emerald-500",
    warning: "text-amber-500",
    info: "text-primary",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold ${tones[tone]}`}>{value}</p>
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          <Icon className={`h-5 w-5 shrink-0 ${tones[tone]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
}

function MinutesBadge({ minutes }: { minutes: number | null }) {
  if (minutes === null) return <span className="text-xs text-muted-foreground">—</span>;
  let cls = "bg-muted text-muted-foreground";
  if (minutes < 5) cls = "bg-emerald-500/15 text-emerald-500";
  else if (minutes < 30) cls = "bg-primary/15 text-primary";
  else if (minutes < 120) cls = "bg-amber-500/15 text-amber-500";
  else cls = "bg-destructive/15 text-destructive";
  const label = minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
  return <span className={`text-[11px] px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
}

export function RealtimeMonitorPanel() {
  const { data, isLoading } = useRealtimeMonitor();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [operatorFilter, setOperatorFilter] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ActiveChatRow | null>(null);

  const stats = data?.stats;
  const operators = data?.operators || [];
  const chats = data?.chats || [];

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chats.filter((c) => {
      if (operatorFilter && c.operator_id !== operatorFilter) return false;
      if (!q) return true;
      return (
        c.contact_name.toLowerCase().includes(q) ||
        c.contact_phone.includes(q) ||
        c.operator_name.toLowerCase().includes(q)
      );
    });
  }, [chats, search, operatorFilter]);

  // Alerts: client awaiting reply 15+ min, OR severe wait 60+ min
  const alerts = useMemo(() => {
    return chats
      .filter((c) =>
        c.last_direction === "incoming" &&
        c.minutes_since_last != null &&
        c.minutes_since_last >= 15
      )
      .sort((a, b) => (b.minutes_since_last || 0) - (a.minutes_since_last || 0));
  }, [chats]);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" text="Carregando monitor em tempo real..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={Circle}
          label="Operadores ao vivo"
          value={`${stats?.operators_live ?? 0} / ${stats?.operators_total ?? 0}`}
          hint="Ativos nos últimos 5 min"
          tone="success"
        />
        <StatCard
          icon={MessageCircle}
          label="Conversas (24h)"
          value={stats?.active_chats_total ?? 0}
          hint="Com mensagens recentes"
          tone="info"
        />
        <StatCard
          icon={AlertCircle}
          label="Aguardando resposta"
          value={stats?.pending_responses ?? 0}
          hint="Cliente foi o último a falar"
          tone="warning"
        />
        <StatCard
          icon={ArrowUpFromLine}
          label="Enviadas hoje"
          value={stats?.msgs_out_today ?? 0}
        />
        <StatCard
          icon={ArrowDownToLine}
          label="Recebidas hoje"
          value={stats?.msgs_in_today ?? 0}
        />
        <StatCard
          icon={Activity}
          label="Total hoje"
          value={(stats?.msgs_in_today ?? 0) + (stats?.msgs_out_today ?? 0)}
          hint="In + Out"
        />
      </div>

      <Tabs defaultValue={alerts.length > 0 ? "alertas" : "chats"} className="space-y-4">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto">
          <TabsTrigger value="alertas" className="gap-1.5">
            <BellRing className={alerts.length > 0 ? "h-4 w-4 text-amber-500" : "h-4 w-4"} />
            Alertas
            {alerts.length > 0 && (
              <Badge className="ml-1 h-4 px-1.5 bg-amber-500 hover:bg-amber-500 text-[10px]">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="chats" className="gap-1.5">
            <MessageCircle className="h-4 w-4" /> Atendimentos ({chats.length})
          </TabsTrigger>
          <TabsTrigger value="operators" className="gap-1.5">
            <Users className="h-4 w-4" /> Operadores ({operators.length})
          </TabsTrigger>
        </TabsList>

        {/* ALERTAS */}
        <TabsContent value="alertas" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Atendimentos que precisam de atenção
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Clientes que enviaram mensagem há 15 minutos ou mais e ainda não foram respondidos.
              </p>
            </CardHeader>
            <CardContent className={isMobile ? "p-3" : "p-0"}>
              {alerts.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">
                  ✓ Nenhum cliente esperando resposta há mais de 15 min.
                </p>
              ) : isMobile ? (
                <div className="space-y-2">
                  {alerts.map((c) => (
                    <ChatMobileCard key={c.contact_id} chat={c} onOpen={() => setViewer(c)} highlight />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[520px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="text-xs">Contato</TableHead>
                        <TableHead className="text-xs">Operador</TableHead>
                        <TableHead className="text-xs">Última mensagem do cliente</TableHead>
                        <TableHead className="text-xs text-center">Esperando há</TableHead>
                        <TableHead className="text-xs text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((c) => (
                        <TableRow key={c.contact_id} className="bg-amber-500/5">
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-7 w-7 shrink-0 rounded-full bg-amber-500/20 flex items-center justify-center text-[11px] font-semibold text-amber-600">
                                {c.contact_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate max-w-[180px]">{c.contact_name}</p>
                                <p className="text-[11px] text-muted-foreground">{c.contact_phone}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-xs">{c.operator_name}</TableCell>
                          <TableCell className="py-2">
                            <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                              {c.last_message_preview || "—"}
                            </p>
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <MinutesBadge minutes={c.minutes_since_last} />
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setViewer(c)}>
                              <Eye className="h-3.5 w-3.5" /> Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATENDIMENTOS */}
        <TabsContent value="chats" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  Mapa de atendimentos
                  {operatorFilter && (
                    <Badge variant="outline" className="text-xs">
                      Filtrado: {operators.find((o) => o.user_id === operatorFilter)?.full_name}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => setOperatorFilter(null)}
                      >×</button>
                    </Badge>
                  )}
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar contato, telefone ou operador..."
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className={isMobile ? "p-3" : "p-0"}>
              {filteredChats.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum atendimento encontrado
                </p>
              ) : isMobile ? (
                <div className="space-y-2">
                  {filteredChats.map((c) => (
                    <ChatMobileCard key={c.contact_id} chat={c} onOpen={() => setViewer(c)} />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[520px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="text-xs">Contato</TableHead>
                        <TableHead className="text-xs">Operador</TableHead>
                        <TableHead className="text-xs">Última mensagem</TableHead>
                        <TableHead className="text-xs text-center">Há</TableHead>
                        <TableHead className="text-xs text-center">Recebidas hoje</TableHead>
                        <TableHead className="text-xs text-center">Status</TableHead>
                        <TableHead className="text-xs text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredChats.map((c) => (
                        <TableRow key={c.contact_id}>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-7 w-7 shrink-0 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-semibold text-primary">
                                {c.contact_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate max-w-[180px]">{c.contact_name}</p>
                                <p className="text-[11px] text-muted-foreground">{c.contact_phone}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className={`text-xs ${c.operator_id ? "" : "text-muted-foreground italic"}`}>
                              {c.operator_name}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                              {c.last_message_preview || "—"}
                            </p>
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <MinutesBadge minutes={c.minutes_since_last} />
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            {c.unread_from_client > 0 ? (
                              <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-semibold">
                                {c.unread_from_client}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {c.ai_enabled && (
                                <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                  <Bot className="h-2.5 w-2.5" /> IA
                                </Badge>
                              )}
                              {c.status && (
                                <Badge variant="secondary" className="text-[10px] h-5">
                                  {c.status}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setViewer(c)}>
                              <Eye className="h-3.5 w-3.5" /> Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPERADORES */}
        <TabsContent value="operators">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Atividade dos operadores
              </CardTitle>
            </CardHeader>
            <CardContent className={isMobile ? "p-3" : "p-0"}>
              {operators.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">Nenhum operador</p>
              ) : isMobile ? (
                <div className="space-y-2">
                  {operators.map((op) => (
                    <OperatorMobileCard
                      key={op.user_id}
                      op={op}
                      onSeeChats={() => {
                        setOperatorFilter(op.user_id);
                        const btn = document.querySelector<HTMLButtonElement>(
                          '[role="tab"][value="chats"]'
                        );
                        btn?.click();
                      }}
                    />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[520px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="text-xs">Operador</TableHead>
                        <TableHead className="text-xs text-center">Status</TableHead>
                        <TableHead className="text-xs text-center">Conversas (24h)</TableHead>
                        <TableHead className="text-xs text-center">Enviadas hoje</TableHead>
                        <TableHead className="text-xs text-center">Recebidas hoje</TableHead>
                        <TableHead className="text-xs">Última atividade</TableHead>
                        <TableHead className="text-xs text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operators.map((op) => (
                        <TableRow key={op.user_id}>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 shrink-0 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-semibold text-primary">
                                {op.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate max-w-[200px]">{op.full_name}</p>
                                <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{op.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            {op.is_blocked ? (
                              <Badge variant="destructive" className="text-[10px] h-5">Bloqueado</Badge>
                            ) : op.is_live ? (
                              <Badge className="text-[10px] h-5 bg-emerald-500 hover:bg-emerald-500">
                                <Circle className="h-1.5 w-1.5 mr-1 fill-current" /> Ao vivo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5">Ocioso</Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <span className="text-sm font-medium">{op.active_chats}</span>
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <span className="text-sm">{op.msgs_sent_today}</span>
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <span className="text-sm">{op.msgs_received_today}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {relativeTime(op.last_activity_at)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1"
                              onClick={() => {
                                setOperatorFilter(op.user_id);
                                const btn = document.querySelector<HTMLButtonElement>(
                                  '[role="tab"][value="chats"]'
                                );
                                btn?.click();
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" /> Conversas
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LiveChatViewer
        open={!!viewer}
        onOpenChange={(o) => !o && setViewer(null)}
        contactId={viewer?.contact_id || null}
        contactName={viewer?.contact_name}
        contactPhone={viewer?.contact_phone}
        operatorName={viewer?.operator_name}
      />

      <p className="text-[11px] text-center text-muted-foreground">
        Atualização automática a cada 5 segundos
      </p>
    </div>
  );
}

function ChatMobileCard({ chat, onOpen, highlight }: { chat: ActiveChatRow; onOpen: () => void; highlight?: boolean }) {
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left rounded-xl border p-3 transition-colors active:scale-[0.99] ${
        highlight
          ? "bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/15"
          : "bg-card hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
          highlight ? "bg-amber-500/20 text-amber-600" : "bg-primary/15 text-primary"
        }`}>
          {chat.contact_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{chat.contact_name}</p>
              <p className="text-[11px] text-muted-foreground">{chat.contact_phone}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <MinutesBadge minutes={chat.minutes_since_last} />
              {chat.unread_from_client > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-semibold">
                  {chat.unread_from_client}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {chat.last_message_preview || "—"}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-5">
              {chat.operator_name}
            </Badge>
            {chat.ai_enabled && (
              <Badge variant="outline" className="text-[10px] h-5 gap-1">
                <Bot className="h-2.5 w-2.5" /> IA
              </Badge>
            )}
            {chat.last_direction === "incoming" && (
              <Badge variant="outline" className="text-[10px] h-5 border-amber-500/50 text-amber-600">
                Cliente aguardando
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function OperatorMobileCard({ op, onSeeChats }: { op: OperatorActivity; onSeeChats: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">
          {op.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{op.full_name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{op.email}</p>
        </div>
        {op.is_blocked ? (
          <Badge variant="destructive" className="text-[10px] h-5">Bloqueado</Badge>
        ) : op.is_live ? (
          <Badge className="text-[10px] h-5 bg-emerald-500 hover:bg-emerald-500">
            <Circle className="h-1.5 w-1.5 mr-1 fill-current" /> Ao vivo
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] h-5">Ocioso</Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-[10px] text-muted-foreground uppercase">Conversas</p>
          <p className="text-base font-bold">{op.active_chats}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-[10px] text-muted-foreground uppercase">Enviadas</p>
          <p className="text-base font-bold">{op.msgs_sent_today}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-[10px] text-muted-foreground uppercase">Recebidas</p>
          <p className="text-base font-bold">{op.msgs_received_today}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {relativeTime(op.last_activity_at)}
        </span>
        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={onSeeChats}>
          <Eye className="h-3.5 w-3.5" /> Conversas
        </Button>
      </div>
    </div>
  );
}

