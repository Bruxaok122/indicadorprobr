import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ShieldAlert, ShieldCheck, AlertTriangle, Ban, PhoneOff } from "lucide-react";
import { useFailureRate } from "@/hooks/useFailureRate";
import { format } from "date-fns";

export function FailureRateCard() {
  const { stats, loading, THRESHOLD } = useFailureRate();

  const rateColor = stats.failureRate >= THRESHOLD
    ? "text-destructive"
    : stats.failureRate >= THRESHOLD / 2
      ? "text-amber-500"
      : "text-emerald-500";

  const StatusIcon = stats.isAboveThreshold ? ShieldAlert : ShieldCheck;

  return (
    <Card className={stats.isAboveThreshold ? "border-destructive/50 shadow-destructive/10 shadow-lg" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Taxa de Falha (2h)</CardTitle>
        <StatusIcon className={`h-5 w-5 ${rateColor}`} />
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <LoadingSpinner size="sm" />
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${rateColor}`}>
                {stats.failureRate.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">
                {stats.totalFailed}/{stats.totalSent} msgs
              </span>
            </div>

            <Progress
              value={Math.min(stats.failureRate, 100)}
              className="h-2"
            />

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Ban className="h-3 w-3 text-destructive" />
                <span>{stats.blockErrors} bloqueios</span>
              </div>
              <div className="flex items-center gap-1">
                <PhoneOff className="h-3 w-3 text-amber-500" />
                <span>{stats.unregisteredErrors} s/ WA</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                <span>{stats.otherErrors} outros</span>
              </div>
            </div>

            {stats.isAboveThreshold && (
              <Badge variant="destructive" className="w-full justify-center text-xs">
                ⚠️ Acima do limite de {THRESHOLD}%
              </Badge>
            )}

            <p className="text-[10px] text-muted-foreground text-right">
              Atualizado: {format(stats.lastUpdated, "HH:mm:ss")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
