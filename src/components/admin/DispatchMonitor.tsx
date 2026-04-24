import { useState, useEffect, useMemo } from "react";
import { useDispatchContext } from "@/contexts/DispatchContext";
import { FailureRateBar } from "@/components/admin/FailureRateBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  User,
  Pause,
  Play,
  XCircle,
  Activity,
  AlertTriangle,
  Coffee,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Send,
  Hourglass,
  Layers,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function BreathingCountdown({ breathingUntil }: { breathingUntil: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const ms = new Date(breathingUntil).getTime() - Date.now();
      if (ms <= 0) {
        setRemaining("");
        return;
      }
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [breathingUntil]);

  if (!remaining) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/25 px-3 py-2 backdrop-blur-sm"
    >
      <Coffee className="h-4 w-4 text-amber-500 animate-pulse" />
      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
        Respirando... próximo bloco em{" "}
        <span className="font-mono tabular-nums font-bold text-amber-600 dark:text-amber-200">
          {remaining}
        </span>
      </span>
    </motion.div>
  );
}

// Animated number counter
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (display === value) return;
    const start = display;
    const diff = value - start;
    const duration = 400;
    const startTime = performance.now();

    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + diff * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={cn("tabular-nums font-mono", className)}>
      {display.toLocaleString("pt-BR")}
    </span>
  );
}

// Custom animated progress bar with shimmer
function AnimatedProgress({
  value,
  variant = "primary",
  animated = true,
}: {
  value: number;
  variant?: "primary" | "success" | "amber" | "muted";
  animated?: boolean;
}) {
  const colorMap = {
    primary: "from-primary via-primary to-primary/80",
    success: "from-emerald-500 via-emerald-400 to-emerald-500",
    amber: "from-amber-500 via-amber-400 to-amber-500",
    muted: "from-muted-foreground/40 to-muted-foreground/30",
  };
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/40 ring-1 ring-inset ring-border/50">
      <motion.div
        className={cn(
          "h-full rounded-full bg-gradient-to-r relative overflow-hidden",
          colorMap[variant]
        )}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {animated && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
            style={{ width: "40%" }}
          />
        )}
      </motion.div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  tone = "muted",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone?: "muted" | "success" | "destructive" | "amber" | "primary";
}) {
  const toneMap = {
    muted: "text-muted-foreground bg-muted/40 border-border/50",
    success: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    destructive: "text-destructive bg-destructive/10 border-destructive/20",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    primary: "text-primary bg-primary/10 border-primary/20",
  };
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium",
        toneMap[tone]
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export function DispatchMonitor() {
  const {
    activeDispatches,
    handlePause,
    handleCancel,
    dismissDispatch,
    dispatchControlsRef,
    loadingFromDb,
  } = useDispatchContext();

  const activeOnes = activeDispatches.filter((d) => !d.isFinished);
  const finishedOnes = activeDispatches.filter((d) => d.isFinished);

  // Aggregate totals
  const totals = useMemo(() => {
    const agg = activeOnes.reduce(
      (acc, d) => {
        acc.total += d.total;
        acc.sent += d.sent;
        acc.failed += d.failed;
        acc.current += d.current;
        return acc;
      },
      { total: 0, sent: 0, failed: 0, current: 0 }
    );
    const remaining = Math.max(0, agg.total - agg.current);
    const successRate = agg.current > 0 ? (agg.sent / agg.current) * 100 : 0;
    return { ...agg, remaining, successRate };
  }, [activeOnes]);

  return (
    <div className="space-y-6">
      <FailureRateBar visible={activeOnes.length > 0} />

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                {activeOnes.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">Acompanhamento</h2>
                <p className="text-xs text-muted-foreground">
                  Monitoramento em tempo real de todos os disparos.
                </p>
              </div>
            </div>
          </div>

          {/* Aggregate stats */}
          {activeOnes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            >
              <StatTile
                icon={Send}
                label="Enviados"
                value={totals.sent}
                tone="success"
              />
              <StatTile
                icon={AlertCircle}
                label="Falhas"
                value={totals.failed}
                tone="destructive"
              />
              <StatTile
                icon={Hourglass}
                label="Restantes"
                value={totals.remaining}
                tone="primary"
              />
              <StatTile
                icon={TrendingUp}
                label="Sucesso"
                value={`${totals.successRate.toFixed(1)}%`}
                tone="amber"
                isText
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Anti-ban protection info */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent px-3 py-2"
      >
        <Shield className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-xs text-emerald-700 dark:text-emerald-300">
          <strong className="font-semibold">Anti-Ban v2:</strong> blocos ~20 (jitter) · 10–12min respiro · seg-sex 10–17h · delay progressivo · limite 500/sessão
        </span>
      </motion.div>

      {loadingFromDb && (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="sm" text="Carregando disparos..." />
        </div>
      )}

      {!loadingFromDb && activeDispatches.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-dashed">
            <CardContent className="py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
                <Activity className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum disparo em andamento
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Inicie um disparo na aba "Disparos" para monitorar aqui.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {activeOnes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
            Em andamento
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {activeOnes.length}
            </Badge>
          </h3>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {activeOnes.map((dispatch) => {
                const isLocallyControlled = !!dispatchControlsRef.current[dispatch.id];
                return (
                  <DispatchCard
                    key={dispatch.id}
                    dispatch={dispatch}
                    isOrphaned={!isLocallyControlled}
                    onPause={() => handlePause(dispatch.id)}
                    onCancel={() => handleCancel(dispatch.id)}
                    onDismiss={() => dismissDispatch(dispatch.id)}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {finishedOnes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Finalizados
            <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px]">
              {finishedOnes.length}
            </Badge>
          </h3>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {finishedOnes.map((dispatch) => (
                <DispatchCard
                  key={dispatch.id}
                  dispatch={dispatch}
                  onPause={() => {}}
                  onCancel={() => {}}
                  onDismiss={() => dismissDispatch(dispatch.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  isText = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone: "success" | "destructive" | "primary" | "amber";
  isText?: boolean;
}) {
  const toneMap = {
    success: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/25 text-emerald-600 dark:text-emerald-400",
    destructive: "from-destructive/15 to-destructive/5 border-destructive/25 text-destructive",
    primary: "from-primary/15 to-primary/5 border-primary/25 text-primary",
    amber: "from-amber-500/15 to-amber-500/5 border-amber-500/25 text-amber-600 dark:text-amber-400",
  };
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border bg-gradient-to-br px-3 py-2 backdrop-blur-sm",
        toneMap[tone]
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <div className="min-w-0 leading-tight">
        <div className="text-[10px] uppercase tracking-wider opacity-70 font-medium">
          {label}
        </div>
        <div className="text-base font-bold">
          {isText ? value : <AnimatedNumber value={value as number} />}
        </div>
      </div>
    </motion.div>
  );
}

function DispatchCard({
  dispatch,
  isOrphaned = false,
  onPause,
  onCancel,
  onDismiss,
}: {
  dispatch: ReturnType<typeof useDispatchContext>["activeDispatches"][0];
  isOrphaned?: boolean;
  onPause: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const progress = dispatch.total > 0 ? (dispatch.current / dispatch.total) * 100 : 0;
  const isBreathing =
    !!dispatch.breathingUntil && new Date(dispatch.breathingUntil).getTime() > Date.now();
  const remaining = Math.max(0, dispatch.total - dispatch.current);
  const successRate =
    dispatch.current > 0 ? (dispatch.sent / dispatch.current) * 100 : 0;

  // Determine status
  const status: {
    label: string;
    icon: React.ElementType;
    tone: "primary" | "success" | "amber" | "destructive" | "muted";
  } = dispatch.isFinished
    ? dispatch.isCancelled
      ? { label: "Cancelado", icon: XCircle, tone: "destructive" }
      : { label: "Concluído", icon: CheckCircle2, tone: "success" }
    : isBreathing
    ? { label: "Respirando", icon: Coffee, tone: "amber" }
    : dispatch.isPaused
    ? { label: "Pausado", icon: Pause, tone: "muted" }
    : { label: "Enviando", icon: Send, tone: "primary" };

  const StatusIcon = status.icon;

  const cardBorder = dispatch.isFinished
    ? dispatch.isCancelled
      ? "border-destructive/25 bg-gradient-to-br from-destructive/5 to-card"
      : "border-emerald-500/25 bg-gradient-to-br from-emerald-500/5 to-card"
    : isBreathing
    ? "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-card"
    : dispatch.isPaused
    ? "border-border bg-gradient-to-br from-muted/30 to-card"
    : "border-primary/30 bg-gradient-to-br from-primary/5 to-card";

  const progressVariant: "primary" | "success" | "amber" | "muted" = dispatch.isFinished
    ? dispatch.isCancelled
      ? "muted"
      : "success"
    : isBreathing
    ? "amber"
    : dispatch.isPaused
    ? "muted"
    : "primary";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      <Card className={cn("overflow-hidden transition-shadow hover:shadow-lg", cardBorder)}>
        <CardContent className="pt-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold truncate">
                    {dispatch.operatorName}
                  </span>
                  <StatusBadge status={status} pulse={!dispatch.isFinished && !dispatch.isPaused && !isBreathing} />
                </div>
                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                    {dispatch.templateName}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                    {dispatch.listName}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal gap-0.5">
                    {dispatch.mode === "individual" ? (
                      <><Zap className="h-2.5 w-2.5" /> Individual</>
                    ) : (
                      <><Layers className="h-2.5 w-2.5" /> Lote</>
                    )}
                  </Badge>
                </div>
              </div>
            </div>

            {!dispatch.isFinished ? (
              isOrphaned ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 text-yellow-500 border-yellow-500/30"
                  >
                    <AlertTriangle className="h-3 w-3" /> Sessão perdida
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDismiss}
                    className="h-7 text-xs text-muted-foreground"
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onPause}
                    className="gap-1 h-7 text-xs"
                  >
                    {dispatch.isPaused ? (
                      <>
                        <Play className="h-3 w-3" /> Retomar
                      </>
                    ) : (
                      <>
                        <Pause className="h-3 w-3" /> Pausar
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={onCancel}
                    className="gap-1 h-7 text-xs"
                  >
                    <XCircle className="h-3 w-3" /> Cancelar
                  </Button>
                </div>
              )
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-7 text-xs text-muted-foreground shrink-0"
              >
                Fechar
              </Button>
            )}
          </div>

          {/* Breathing countdown */}
          <AnimatePresence>
            {isBreathing && dispatch.breathingUntil && (
              <BreathingCountdown breathingUntil={dispatch.breathingUntil} />
            )}
          </AnimatePresence>

          {/* Progress section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                <StatusIcon
                  className={cn(
                    "h-3.5 w-3.5",
                    status.tone === "primary" && "text-primary",
                    status.tone === "success" && "text-emerald-500",
                    status.tone === "amber" && "text-amber-500",
                    status.tone === "destructive" && "text-destructive",
                    status.tone === "muted" && "text-muted-foreground",
                    !dispatch.isFinished && !dispatch.isPaused && status.tone === "primary" && "animate-pulse"
                  )}
                />
                <span className="font-medium text-foreground/90">
                  <AnimatedNumber value={dispatch.current} />
                  <span className="text-muted-foreground"> / {dispatch.total.toLocaleString("pt-BR")}</span>
                </span>
                <span className="text-muted-foreground">processados</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {progress.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <AnimatedProgress
              value={progress}
              variant={progressVariant}
              animated={!dispatch.isFinished && !dispatch.isPaused && !isBreathing}
            />
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {dispatch.sent > 0 && (
              <StatPill
                icon={CheckCircle2}
                label="Enviados"
                value={<AnimatedNumber value={dispatch.sent} />}
                tone="success"
              />
            )}
            {dispatch.failed > 0 && (
              <StatPill
                icon={AlertCircle}
                label="Falhas"
                value={<AnimatedNumber value={dispatch.failed} />}
                tone="destructive"
              />
            )}
            {!dispatch.isFinished && remaining > 0 && (
              <StatPill
                icon={Hourglass}
                label="Restantes"
                value={<AnimatedNumber value={remaining} />}
                tone="primary"
              />
            )}
            {dispatch.current > 0 && (
              <StatPill
                icon={TrendingUp}
                label="Taxa"
                value={`${successRate.toFixed(1)}%`}
                tone={successRate >= 95 ? "success" : successRate >= 80 ? "amber" : "destructive"}
              />
            )}
            {dispatch.blocksSent !== undefined && dispatch.blocksSent > 0 && (
              <StatPill
                icon={Layers}
                label="Blocos"
                value={dispatch.blocksSent}
                tone="amber"
              />
            )}
          </div>

          {/* Errors */}
          {dispatch.errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="max-h-24 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive space-y-0.5"
            >
              {dispatch.errors.slice(-5).map((err, i) => (
                <p key={i} className="leading-relaxed">
                  • {err}
                </p>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatusBadge({
  status,
  pulse,
}: {
  status: {
    label: string;
    icon: React.ElementType;
    tone: "primary" | "success" | "amber" | "destructive" | "muted";
  };
  pulse: boolean;
}) {
  const toneMap = {
    primary: "bg-primary/15 text-primary border-primary/30",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    destructive: "bg-destructive/15 text-destructive border-destructive/30",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
        toneMap[status.tone]
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {status.label}
    </span>
  );
}
