import { useDispatchContext } from "@/contexts/DispatchContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { User, Pause, Play, XCircle, Activity } from "lucide-react";
import { motion } from "framer-motion";

export function DispatchMonitor() {
  const { activeDispatches, handlePause, handleCancel, dismissDispatch } = useDispatchContext();

  const activeOnes = activeDispatches.filter((d) => !d.isFinished);
  const finishedOnes = activeDispatches.filter((d) => d.isFinished);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Acompanhamento
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Monitore todos os disparos em andamento em tempo real.
        </p>
      </div>

      {activeDispatches.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum disparo em andamento</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Inicie um disparo na aba "Disparos" para monitorar aqui.
            </p>
          </CardContent>
        </Card>
      )}

      {activeOnes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
            Em andamento ({activeOnes.length})
          </h3>
          <div className="space-y-3">
            {activeOnes.map((dispatch) => (
              <DispatchCard
                key={dispatch.id}
                dispatch={dispatch}
                onPause={() => handlePause(dispatch.id)}
                onCancel={() => handleCancel(dispatch.id)}
                onDismiss={() => dismissDispatch(dispatch.id)}
              />
            ))}
          </div>
        </div>
      )}

      {finishedOnes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Finalizados ({finishedOnes.length})
          </h3>
          <div className="space-y-3">
            {finishedOnes.map((dispatch) => (
              <DispatchCard
                key={dispatch.id}
                dispatch={dispatch}
                onPause={() => {}}
                onCancel={() => {}}
                onDismiss={() => dismissDispatch(dispatch.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={dispatch.isFinished ? "border-muted" : "border-primary/30 bg-primary/5"}>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold truncate">{dispatch.operatorName}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {dispatch.templateName}
              </Badge>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {dispatch.listName}
              </Badge>
            </div>
            {!dispatch.isFinished ? (
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={onPause} className="gap-1 h-7 text-xs">
                  {dispatch.isPaused ? (
                    <><Play className="h-3 w-3" /> Retomar</>
                  ) : (
                    <><Pause className="h-3 w-3" /> Pausar</>
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

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                {dispatch.isPaused ? "⏸️ Pausado" : dispatch.isFinished ? (dispatch.isCancelled ? "🚫 Cancelado" : "✅ Concluído") : "📤 Enviando..."}
              </span>
              <span className="font-semibold text-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2.5" />
            <div className="flex flex-wrap gap-3 text-xs pt-0.5">
              <span className="text-muted-foreground">{dispatch.current}/{dispatch.total} processados</span>
              <span className="text-muted-foreground">({dispatch.mode === "individual" ? "Individual" : "Lote"})</span>
              {dispatch.sent > 0 && <span className="text-success font-medium">✓ {dispatch.sent} enviados</span>}
              {dispatch.failed > 0 && <span className="text-destructive font-medium">✗ {dispatch.failed} falhas</span>}
            </div>
          </div>

          {dispatch.errors.length > 0 && (
            <div className="max-h-24 overflow-y-auto rounded border p-2 text-xs text-destructive space-y-0.5">
              {dispatch.errors.slice(-5).map((err, i) => <p key={i}>{err}</p>)}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
