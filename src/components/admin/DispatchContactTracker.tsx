import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Pause,
  Play,
  SkipForward,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export type ContactDispatchStatus =
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

export interface DispatchContact {
  id: string;
  name: string;
  phone: string;
}

export interface ContactState {
  status: ContactDispatchStatus;
  error?: string;
}

export interface DispatchTrackerRef {
  getContactState: (id: string) => ContactState | undefined;
  isContactSkipped: (id: string) => boolean;
  setContactStatus: (id: string, status: ContactDispatchStatus, error?: string) => void;
  getStats: () => { sent: number; failed: number; skipped: number; queued: number; total: number };
}

interface DispatchContactTrackerProps {
  contacts: DispatchContact[];
  isDispatching: boolean;
  onPauseAll: () => void;
  onCancelAll: () => void;
  isPausedGlobal: boolean;
}

const statusConfig: Record<ContactDispatchStatus, { icon: any; label: string; color: string }> = {
  queued: { icon: Clock, label: "Na fila", color: "text-muted-foreground" },
  sending: { icon: Loader2, label: "Enviando", color: "text-primary" },
  sent: { icon: CheckCircle, label: "Enviado", color: "text-success" },
  failed: { icon: XCircle, label: "Falhou", color: "text-destructive" },
  skipped: { icon: SkipForward, label: "Pulado", color: "text-muted-foreground" },
};

const DispatchContactTracker = forwardRef<DispatchTrackerRef, DispatchContactTrackerProps>(
  ({ contacts, isDispatching, onPauseAll, onCancelAll, isPausedGlobal }, ref) => {
    const [contactStates, setContactStates] = useState<Record<string, ContactState>>({});

    useEffect(() => {
      const initial: Record<string, ContactState> = {};
      contacts.forEach((c) => {
        initial[c.id] = { status: "queued" };
      });
      setContactStates(initial);
    }, [contacts]);

    const contactStatesRef = useRef(contactStates);
    useEffect(() => {
      contactStatesRef.current = contactStates;
    }, [contactStates]);

    useImperativeHandle(ref, () => ({
      getContactState: (id: string) => contactStatesRef.current[id],
      isContactSkipped: (id: string) => contactStatesRef.current[id]?.status === "skipped",
      setContactStatus: (id: string, status: ContactDispatchStatus, error?: string) => {
        setContactStates((prev) => ({ ...prev, [id]: { status, error } }));
      },
      getStats: () => {
        const states = Object.values(contactStatesRef.current);
        return {
          sent: states.filter((s) => s.status === "sent").length,
          failed: states.filter((s) => s.status === "failed").length,
          skipped: states.filter((s) => s.status === "skipped").length,
          queued: states.filter((s) => s.status === "queued" || s.status === "sending").length,
          total: states.length,
        };
      },
    }));

    const handleSkipContact = (id: string) => {
      setContactStates((prev) => ({
        ...prev,
        [id]: { status: "skipped" },
      }));
    };

    const stats = (() => {
      const states = Object.values(contactStates);
      return {
        sent: states.filter((s) => s.status === "sent").length,
        failed: states.filter((s) => s.status === "failed").length,
        skipped: states.filter((s) => s.status === "skipped").length,
        queued: states.filter((s) => s.status === "queued" || s.status === "sending").length,
        total: states.length,
      };
    })();

    const progressPercent = stats.total > 0 ? ((stats.sent + stats.failed + stats.skipped) / stats.total) * 100 : 0;

    if (!isDispatching && contacts.length === 0) return null;

    return (
      <div className="space-y-3">
        {/* Global controls */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {isDispatching
              ? isPausedGlobal
                ? "⏸️ Disparo pausado para todos"
                : "📤 Disparando..."
              : "Resultado do disparo"}
          </span>
          {isDispatching && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onPauseAll} className="gap-1.5 h-7 text-xs">
                {isPausedGlobal ? (
                  <><Play className="h-3 w-3" /> Retomar Todos</>
                ) : (
                  <><Pause className="h-3 w-3" /> Pausar Todos</>
                )}
              </Button>
              <Button size="sm" variant="destructive" onClick={onCancelAll} className="gap-1.5 h-7 text-xs">
                <XCircle className="h-3 w-3" /> Cancelar
              </Button>
            </div>
          )}
        </div>

        <Progress value={progressPercent} className="h-2" />

        {/* Stats */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="text-muted-foreground">
            {stats.sent + stats.failed + stats.skipped}/{stats.total}
          </span>
          {stats.sent > 0 && <span className="text-success">✓ {stats.sent} enviados</span>}
          {stats.failed > 0 && <span className="text-destructive">✗ {stats.failed} falhas</span>}
          {stats.skipped > 0 && <span className="text-muted-foreground">⏭ {stats.skipped} pulados</span>}
        </div>

        {/* Contact list */}
        <ScrollArea className="h-[280px] rounded-lg border">
          <div className="p-2 space-y-1">
            <AnimatePresence initial={false}>
              {contacts.map((contact) => {
                const state = contactStates[contact.id] || { status: "queued" };
                const config = statusConfig[state.status];
                const StatusIcon = config.icon;
                const isSending = state.status === "sending";
                const canSkip = state.status === "queued" && isDispatching;

                return (
                  <motion.div
                    key={contact.id}
                    layout
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      state.status === "sending" && "bg-primary/5",
                      state.status === "sent" && "bg-success/5",
                      state.status === "failed" && "bg-destructive/5",
                      state.status === "skipped" && "bg-muted/50 opacity-60"
                    )}
                  >
                    <StatusIcon
                      className={cn("h-4 w-4 shrink-0", config.color, isSending && "animate-spin")}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-xs">{contact.name}</p>
                      <p className="text-[10px] text-muted-foreground">{contact.phone}</p>
                      {state.error && (
                        <p className="text-[10px] text-destructive truncate">{state.error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canSkip && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handleSkipContact(contact.id)}
                          title="Pular este contato"
                        >
                          <SkipForward className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      )}
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-1.5 py-0", config.color)}
                      >
                        {config.label}
                      </Badge>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    );
  }
);

DispatchContactTracker.displayName = "DispatchContactTracker";

export default DispatchContactTracker;
