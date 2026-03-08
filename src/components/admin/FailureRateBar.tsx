import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useFailureRate } from "@/hooks/useFailureRate";
import { motion, AnimatePresence } from "framer-motion";

interface FailureRateBarProps {
  visible: boolean;
}

export function FailureRateBar({ visible }: FailureRateBarProps) {
  const { stats, loading, THRESHOLD } = useFailureRate(visible);

  if (!visible || loading || stats.totalSent === 0) return null;

  const isWarning = stats.failureRate >= THRESHOLD / 2 && !stats.isAboveThreshold;
  const isDanger = stats.isAboveThreshold;

  const bgClass = isDanger
    ? "bg-destructive/10 border-destructive/30"
    : isWarning
      ? "bg-amber-500/10 border-amber-500/30"
      : "bg-emerald-500/10 border-emerald-500/30";

  const textClass = isDanger
    ? "text-destructive"
    : isWarning
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  const Icon = isDanger ? ShieldAlert : ShieldCheck;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2 mb-4 ${bgClass}`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${textClass} ${isDanger ? "animate-pulse" : ""}`} />
          <span className={`text-sm font-medium ${textClass}`}>
            Taxa de falha: {stats.failureRate.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{stats.totalFailed} falhas / {stats.totalSent} enviadas</span>
          {stats.blockErrors > 0 && (
            <span className="text-destructive font-medium">
              {stats.blockErrors} bloqueio{stats.blockErrors > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
