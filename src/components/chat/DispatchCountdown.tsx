import { useState, useEffect, useRef } from "react";
import { useDispatchContext } from "@/contexts/DispatchContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { Send, Timer, CheckCircle, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DispatchCountdown() {
  const { user } = useAuthContext();
  const { activeDispatches, dismissDispatch } = useDispatchContext();
  const [now, setNow] = useState(Date.now());
  const dismissedRef = useRef<Set<string>>(new Set());

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-dismiss finished OR fully-counted dispatches after a short grace period.
  // The count-based check is a safety net for cases where the runner ran on
  // another tab/client (e.g. admin dispatching for a specific operator) and
  // the isFinished flag arrived late or not at all.
  useEffect(() => {
    const mine = activeDispatches.filter(
      (d) =>
        d.operatorId === user?.id &&
        (d.isFinished || (d.total > 0 && d.current >= d.total))
    );
    for (const d of mine) {
      if (dismissedRef.current.has(d.id)) continue;
      dismissedRef.current.add(d.id);
      setTimeout(() => dismissDispatch(d.id), 4000);
    }
  }, [activeDispatches, user?.id, dismissDispatch]);

  // Get operator's active (non-finished) dispatches
  const myDispatches = activeDispatches.filter(
    (d) =>
      d.operatorId === user?.id &&
      !d.isFinished &&
      !(d.total > 0 && d.current >= d.total)
  );

  if (myDispatches.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className="fixed bottom-3 left-3 z-50 flex flex-col gap-1.5 pointer-events-none"
      >

        {myDispatches.map((dispatch) => {
          const nextSendAt = dispatch.nextSendAt
            ? new Date(dispatch.nextSendAt).getTime()
            : null;
          const remainingMs = nextSendAt ? Math.max(0, nextSendAt - now) : 0;
          const remainingSec = Math.ceil(remainingMs / 1000);
          const progress = dispatch.total > 0 ? Math.round((dispatch.current / dispatch.total) * 100) : 0;
          const isWaiting = remainingSec > 0 && !dispatch.isPaused;

          return (
            <motion.div
              key={dispatch.id}
              layout
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md border",
                dispatch.isPaused
                  ? "bg-warning/15 border-warning/30 text-warning"
                  : isWaiting
                  ? "bg-primary/10 border-primary/25 text-primary"
                  : "bg-success/10 border-success/25 text-success"
              )}
            >
              {dispatch.isPaused ? (
                <Pause className="h-3.5 w-3.5" />
              ) : isWaiting ? (
                <Timer className="h-3.5 w-3.5 animate-pulse" />
              ) : (
                <Send className="h-3.5 w-3.5 animate-pulse" />
              )}

              <div className="flex items-center gap-1.5">
                {dispatch.isPaused ? (
                  <span>Pausado</span>
                ) : isWaiting ? (
                  <>
                    <span className="font-mono tabular-nums text-sm">
                      {formatCountdown(remainingSec)}
                    </span>
                    <span className="text-muted-foreground">próximo</span>
                  </>
                ) : (
                  <span>Enviando...</span>
                )}
              </div>

              <span className="text-[10px] text-muted-foreground/70 ml-1">
                {dispatch.sent}/{dispatch.total}
              </span>

              {/* Mini progress bar */}
              <div className="w-8 h-1 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    dispatch.isPaused ? "bg-warning" : "bg-primary"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
