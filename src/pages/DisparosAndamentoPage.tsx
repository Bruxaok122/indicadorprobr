import { AppLayout } from "@/components/layout/AppLayout";
import { useDispatchContext } from "@/contexts/DispatchContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { User, Pause, Play, XCircle, Radio, Inbox } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function DisparosAndamentoPage() {
  const { activeDispatches, pauseDispatch, cancelDispatch, removeDispatch } = useDispatchContext();

  const inProgress = activeDispatches.filter((d) => !d.isFinished);
  const finished = activeDispatches.filter((d) => d.isFinished);

  return (
    <AppLayout>
      <div className="flex h-screen flex-col overflow-hidden bg-muted dark:bg-background">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="shrink-0 px-4 md:px-6 pt-5 pb-2"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-md">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Disparos em Andamento</h1>
              <p className="text-sm text-muted-foreground">
                {inProgress.length > 0
                  ? `${inProgress.length} disparo(s) ativo(s)`
                  : "Nenhum disparo em andamento"}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="flex-1 overflow-auto px-3 md:px-5 pb-6 scrollbar-thin">
          <div className="mx-auto max-w-3xl space-y-4 mt-3">
            {activeDispatches.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/50 mb-4"
                >
                  <Inbox className="h-7 w-7 text-muted-foreground/40" />
                </motion.div>
                <p className="text-sm font-medium text-muted-foreground">Nenhum disparo ativo</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Inicie um disparo na aba de Disparos do painel administrativo
                </p>
              </motion.div>
            )}

            {/* Active dispatches */}
            {inProgress.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                  </span>
                  Em andamento
                </h2>
                <AnimatePresence>
                  {inProgress.map((dispatch) => (
                    <DispatchCard
                      key={dispatch.id}
                      dispatch={dispatch}
                      onPause={() => pauseDispatch(dispatch.id)}
                      onCancel={() => cancelDispatch(dispatch.id)}
                      onDismiss={() => removeDispatch(dispatch.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Finished dispatches */}
            {finished.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">Finalizados</h2>
                <AnimatePresence>
                  {finished.map((dispatch) => (
                    <DispatchCard
                      key={dispatch.id}
                      dispatch={dispatch}
                      onPause={() => pauseDispatch(dispatch.id)}
                      onCancel={() => cancelDispatch(dispatch.id)}
                      onDismiss={() => removeDispatch(dispatch.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function DispatchCard({
  dispatch,
  onPause,
  onCancel,
  onDismiss,
}: {
  dispatch: ReturnType<typeof useDispatchContext>["activeDispatches"][0];
  onPause: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const progress = dispatch.total > 0 ? (dispatch.current / dispatch.total) * 100 : 0;

  const statusLabel = dispatch.isPaused
    ? "⏸️ Pausado"
    : dispatch.isFinished
      ? dispatch.isCancelled
        ? "🚫 Cancelado"
        : "✅ Concluído"
      : "📤 Enviando...";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={
          dispatch.isFinished
            ? "border-muted"
            : dispatch.isPaused
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-primary/30 bg-primary/5"
        }
      >
        <CardContent className="pt-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 shrink-0">
                <User className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{dispatch.operatorName}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    {dispatch.templateName}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {dispatch.listName}
                  </Badge>
                  {dispatch.phoneName && (
                    <Badge variant="secondary" className="text-[10px]">
                      📞 {dispatch.phoneName}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {!dispatch.isFinished ? (
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={onPause} className="gap-1 h-7 text-xs">
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
                <Button size="sm" variant="destructive" onClick={onCancel} className="gap-1 h-7 text-xs">
                  <XCircle className="h-3 w-3" /> Cancelar
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7 text-xs text-muted-foreground">
                Fechar
              </Button>
            )}
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">{statusLabel}</span>
              <span className="font-semibold text-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2.5" />
            <div className="flex flex-wrap gap-3 text-xs pt-0.5">
              <span className="text-muted-foreground">
                {dispatch.current}/{dispatch.total} processados
              </span>
              <span className="text-muted-foreground">
                ({dispatch.mode === "individual" ? "Individual" : "Lote"})
              </span>
              {dispatch.sent > 0 && (
                <span className="text-success font-medium">✓ {dispatch.sent} enviados</span>
              )}
              {dispatch.failed > 0 && (
                <span className="text-destructive font-medium">✗ {dispatch.failed} falhas</span>
              )}
            </div>
          </div>

          {/* Errors */}
          {dispatch.errors.length > 0 && (
            <div className="max-h-20 overflow-y-auto rounded border p-2 text-xs text-destructive space-y-0.5">
              {dispatch.errors.slice(-3).map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
