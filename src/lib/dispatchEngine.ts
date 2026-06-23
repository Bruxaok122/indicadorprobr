// Shared dispatch engine — copied verbatim from AdminDisparosPage logic.
// Used by both AdminDisparosPage and OperatorDisparosPage so they share the
// same anti-ban protections, breathing windows, circuit breakers, etc.
//
// IMPORTANT: Keep this file behavior-identical to the admin engine.
// If you change anti-ban logic, double-check both pages.

import { resilientDelay } from "@/lib/resilientDelay";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ActiveDispatch, DispatchMode } from "@/contexts/DispatchContext";
import type { MetaTemplate } from "@/hooks/useMetaTemplates";

// === Anti-ban protection constants ===
export const ANTI_BAN_BLOCK_SIZE = 20;
export const ANTI_BAN_BREATHING_MS = 10 * 60 * 1000;
export const ANTI_BAN_MIN_DELAY_MS = 3000;
export const ANTI_BAN_MAX_DELAY_MS = 8000;
export const ANTI_BAN_DAILY_LIMIT = 500;
export const ANTI_BAN_PROGRESSIVE_FACTOR = 1.15;
export const ANTI_BAN_BLOCK_JITTER = 4;

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getBrtHour(): number {
  const now = new Date();
  return (now.getUTCHours() - 3 + 24) % 24;
}

/** ⚠️ TEMPORARILY BYPASSED FOR TESTING — matches admin */
export function isWithinDispatchHours(): boolean {
  return true;
}

export function getJitteredBlockSize(): number {
  return ANTI_BAN_BLOCK_SIZE + randomBetween(-ANTI_BAN_BLOCK_JITTER, ANTI_BAN_BLOCK_JITTER);
}

export function getProgressiveDelay(blocksCompleted: number, baseMin: number, baseMax: number): [number, number] {
  const factor = Math.pow(ANTI_BAN_PROGRESSIVE_FACTOR, blocksCompleted);
  return [Math.round(baseMin * factor), Math.round(baseMax * factor)];
}

export function msUntilNextWindow(): number {
  const now = new Date();
  const brtHour = getBrtHour();
  const brtMinute = now.getUTCMinutes();
  if (brtHour >= 17) {
    const hoursUntil = 24 - brtHour + 10;
    return (hoursUntil * 60 - brtMinute) * 60 * 1000;
  }
  if (brtHour < 10) {
    const hoursUntil = 10 - brtHour;
    return (hoursUntil * 60 - brtMinute) * 60 * 1000;
  }
  return 0;
}

export type ControlsRef = React.MutableRefObject<Record<string, { isPaused: boolean; isCancelled: boolean }>>;
export type UpdateDispatchFn = (id: string, updates: Partial<ActiveDispatch>) => void;

export async function breathingWait(
  dispatchId: string,
  durationMs: number,
  updateDispatch: UpdateDispatchFn,
  controlsRef: ControlsRef,
) {
  const until = new Date(Date.now() + durationMs).toISOString();
  updateDispatch(dispatchId, { breathingUntil: until });
  const endTime = Date.now() + durationMs;
  while (Date.now() < endTime) {
    const ctrl = controlsRef.current[dispatchId];
    if (ctrl?.isCancelled) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  updateDispatch(dispatchId, { breathingUntil: undefined });
}

export async function waitForDispatchWindow(
  dispatchId: string,
  updateDispatch: UpdateDispatchFn,
  controlsRef: ControlsRef,
): Promise<boolean> {
  if (isWithinDispatchHours()) return true;
  const waitMs = msUntilNextWindow();
  if (waitMs <= 0) return true;
  const until = new Date(Date.now() + waitMs).toISOString();
  updateDispatch(dispatchId, { breathingUntil: until });
  while (!isWithinDispatchHours()) {
    const ctrl = controlsRef.current[dispatchId];
    if (ctrl?.isCancelled) {
      updateDispatch(dispatchId, { breathingUntil: undefined });
      return false;
    }
    await new Promise((r) => setTimeout(r, 30000));
  }
  updateDispatch(dispatchId, { breathingUntil: undefined });
  return true;
}

export async function getInvokeErrorMessage(sendError: any): Promise<string> {
  const fallback = sendError?.message || "Falha ao chamar função de disparo";
  const statusCode = sendError?.context?.status;
  const statusLabel = statusCode ? ` (HTTP ${statusCode})` : "";
  const response = sendError?.context;
  if (response && typeof response.clone === "function") {
    try {
      const rawText = await response.clone().text();
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          const backendMessage =
            (typeof parsed?.error === "string" && parsed.error) ||
            (typeof parsed?.message === "string" && parsed.message) ||
            null;
          if (backendMessage) return `${backendMessage}${statusLabel}`;
        } catch {
          return `${rawText}${statusLabel}`;
        }
      }
    } catch { /* ignore */ }
  }
  return `${fallback}${statusLabel}`;
}

/** Default contact precheck: contact still in pool (user_id IS NULL). Used by admin. */
export async function defaultContactStillAvailable(contactId: string): Promise<boolean> {
  const { data } = await supabase
    .from("contacts")
    .select("id, user_id")
    .eq("id", contactId)
    .maybeSingle();
  return !!data && data.user_id === null;
}

export interface RunDispatchOptions {
  dispatchId: string;
  contactIds: string[];
  template: MetaTemplate;
  userId: string;
  assignedUserId: string | null; // null when shared
  sharedDispatch: boolean;
  selectedPhoneNumberId?: string;
  variableMappings: Record<string, string>;
  phoneVerifiedName: string;
  mode: DispatchMode;
  intervalSeconds: number;
  randomJitter412: boolean;
  batchMode: boolean;
  batchSize: number;
  turboLimit: number;
  /** Scheduled-mode chunk size (contacts sent per cycle). */
  scheduledChunkSize?: number;
  /** Scheduled-mode interval between cycles, in minutes (min 25). */
  scheduledIntervalMinutes?: number;
  /** Scheduled-mode hard stop hour in BRT (default 18 = 6pm). */
  scheduledStopHourBrt?: number;
  listName: string;
  minIncome?: number;
  /** Re-fetches remaining contacts on pause-resume. Receives optional limit + minIncome. */
  fetchRemaining: (listName: string, limit?: number, minIncome?: number) => Promise<string[]>;
  /** Pre-send availability check. Defaults to pool check. */
  contactStillAvailable?: (contactId: string) => Promise<boolean>;
  updateDispatch: UpdateDispatchFn;
  controlsRef: ControlsRef;
  operatorDisplayName: string;
  onFinally?: () => void;
}

/**
 * Runs the dispatch loop in the background (fire-and-forget).
 * Returns immediately; the loop runs as an IIFE.
 */
export function runDispatch(opts: RunDispatchOptions): void {
  const {
    dispatchId,
    contactIds,
    template,
    userId,
    assignedUserId,
    sharedDispatch,
    selectedPhoneNumberId,
    variableMappings,
    phoneVerifiedName,
    mode,
    intervalSeconds,
    randomJitter412,
    batchMode,
    batchSize,
    turboLimit,
    scheduledChunkSize,
    scheduledIntervalMinutes,
    scheduledStopHourBrt,
    listName,
    minIncome,
    fetchRemaining,
    contactStillAvailable = defaultContactStillAvailable,
    updateDispatch,
    controlsRef,
    operatorDisplayName,
    onFinally,
  } = opts;

  const isTurbo = mode === "turbo";
  const isScheduled = mode === "scheduled";

  const invokeBody = (contactIdsArg: string[]) => ({
    contactIds: contactIdsArg,
    templateName: template.name,
    templateLanguage: template.language,
    userId,
    assignedUserId: sharedDispatch ? undefined : assignedUserId,
    selectedPhoneNumberId: selectedPhoneNumberId || undefined,
    variableMappings,
    phoneVerifiedName,
    dispatchMode: sharedDispatch ? "shared" : "private",
  });

  (async () => {
    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] };
    let remainingIds = [...contactIds];
    let blockMessageCount = 0;
    let currentBlockSize = getJitteredBlockSize();
    let blocksCompleted = 0;
    let consecutiveErrors = 0;

    try {
      if (isScheduled) {
        // 📅 SCHEDULED MODE — sends `scheduledChunkSize` contacts every
        // `scheduledIntervalMinutes` minutes, stops at `scheduledStopHourBrt` BRT.
        const chunkSize = Math.max(1, scheduledChunkSize ?? 3);
        const intervalMin = Math.max(25, scheduledIntervalMinutes ?? 25);
        const stopHour = Math.min(23, Math.max(0, scheduledStopHourBrt ?? 18));
        const intervalMs = intervalMin * 60 * 1000;
        let i = 0;
        let cycle = 0;
        toast.info(`📅 Programado: ${chunkSize} a cada ${intervalMin} min até ${stopHour}h BRT.`, { duration: 8000 });

        while (i < remainingIds.length) {
          const ctrl = controlsRef.current[dispatchId];
          if (ctrl?.isCancelled) break;
          if (ctrl?.isPaused) {
            while (ctrl?.isPaused && !ctrl?.isCancelled) await new Promise((r) => setTimeout(r, 500));
            if (ctrl?.isCancelled) break;
          }

          if (getBrtHour() >= stopHour) {
            toast.info(`🌙 Programado encerrado às ${stopHour}h BRT.`, { duration: 10000 });
            break;
          }

          const chunk = remainingIds.slice(i, i + chunkSize);
          const available: string[] = [];
          for (const id of chunk) {
            if (await contactStillAvailable(id)) available.push(id);
            else results.skipped++;
          }

          if (available.length > 0) {
            const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
              body: invokeBody(available),
            });
            if (!sendError && result?.results) {
              results.sent += result.results.sent || 0;
              results.failed += result.results.failed || 0;
              if (result.results.errors) results.errors.push(...result.results.errors);
              if (result.results.errors?.some((e: string) => e.includes("Conta Business bloqueada"))) {
                toast.error("🛑 Conta Business bloqueada! Parando disparo imediatamente.", { duration: 30000 });
                break;
              }
            } else {
              results.failed += available.length;
              if (sendError) results.errors.push(await getInvokeErrorMessage(sendError));
              const statusCode = (sendError as any)?.context?.status;
              if (statusCode === 401 || statusCode === 403) break;
            }
          }

          cycle++;
          i += chunkSize;
          updateDispatch(dispatchId, {
            current: results.sent + results.failed + results.skipped,
            sent: results.sent,
            failed: results.failed,
            errors: [...results.errors],
            blocksSent: cycle,
          });

          if (i >= remainingIds.length) break;

          // Wait the user-defined interval, polling every 5s for cancel / stop-hour.
          const nextAt = new Date(Date.now() + intervalMs).toISOString();
          updateDispatch(dispatchId, { nextSendAt: nextAt });
          const endTime = Date.now() + intervalMs;
          let stoppedByHour = false;
          while (Date.now() < endTime) {
            const c = controlsRef.current[dispatchId];
            if (c?.isCancelled) break;
            if (getBrtHour() >= stopHour) { stoppedByHour = true; break; }
            await new Promise((r) => setTimeout(r, 5000));
          }
          updateDispatch(dispatchId, { nextSendAt: undefined });
          if (stoppedByHour) {
            toast.info(`🌙 Programado encerrado às ${stopHour}h BRT.`, { duration: 10000 });
            break;
          }
        }
      } else if (isTurbo) {
        // ⚡ TURBO MODE
        let i = 0;
        while (i < remainingIds.length) {
          const ctrl = controlsRef.current[dispatchId];
          if (ctrl?.isCancelled) break;
          if (ctrl?.isPaused) {
            while (ctrl?.isPaused && !ctrl?.isCancelled) await new Promise((r) => setTimeout(r, 500));
            if (ctrl?.isCancelled) break;
          }

          const contactId = remainingIds[i];
          const available = await contactStillAvailable(contactId);
          if (!available) {
            results.skipped++;
            i++;
            updateDispatch(dispatchId, { current: results.sent + results.failed + results.skipped });
            continue;
          }

          const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
            body: invokeBody([contactId]),
          });

          if (!sendError && result?.results) {
            if (result.results.failed > 0) {
              results.failed += result.results.failed;
              if (result.results.errors) results.errors.push(...result.results.errors);
              updateDispatch(dispatchId, {
                current: results.sent + results.failed + results.skipped,
                sent: results.sent, failed: results.failed, errors: [...results.errors],
              });
              toast.error(`🛑 Turbo: Erro detectado, parando imediatamente.`, { duration: 15000 });
              break;
            }
            results.sent += result.results.sent || 0;
          } else {
            results.failed++;
            if (sendError) results.errors.push(await getInvokeErrorMessage(sendError));
            updateDispatch(dispatchId, {
              current: results.sent + results.failed + results.skipped,
              sent: results.sent, failed: results.failed, errors: [...results.errors],
            });
            toast.error(`🛑 Turbo: Erro na API, parando imediatamente.`, { duration: 15000 });
            break;
          }

          updateDispatch(dispatchId, {
            current: results.sent + results.failed + results.skipped,
            sent: results.sent, failed: results.failed, errors: [...results.errors],
          });

          i++;

          let turboDelayMs: number;
          if (randomJitter412) {
            turboDelayMs = randomBetween(4000, 12000);
          } else {
            const baseDelayMs = Math.max(intervalSeconds * 1000, 2000);
            const jitterMs = Math.floor(baseDelayMs * (0.05 + Math.random() * 0.20));
            turboDelayMs = baseDelayMs + jitterMs;
          }
          if (i < remainingIds.length && !ctrl?.isCancelled) {
            const waited = await resilientDelay(turboDelayMs, () => controlsRef.current[dispatchId]);
            if (!waited) break;
          }
        }
      } else if (mode === "individual") {
        let i = 0;
        while (i < remainingIds.length) {
          const ctrl = controlsRef.current[dispatchId];
          if (ctrl?.isCancelled) break;

          if (ctrl?.isPaused) {
            while (ctrl?.isPaused && !ctrl?.isCancelled) await new Promise((r) => setTimeout(r, 500));
            if (ctrl?.isCancelled) break;
            const freshIds = await fetchRemaining(listName, batchMode ? Math.max(batchSize - results.sent, 1) : undefined, minIncome);
            remainingIds = freshIds;
            i = 0;
            updateDispatch(dispatchId, { total: results.sent + results.failed + results.skipped + remainingIds.length });
            if (remainingIds.length === 0) break;
            continue;
          }

          if (!isWithinDispatchHours()) {
            toast.info("⏰ Fora do horário (10-17h BRT). Aguardando próxima janela...", { id: `dispatch-window-${dispatchId}`, duration: 15000 });
            const canContinue = await waitForDispatchWindow(dispatchId, updateDispatch, controlsRef);
            if (!canContinue) break;
            toast.success("✅ Janela de disparo aberta! Retomando...", { id: `dispatch-window-${dispatchId}`, duration: 5000 });
          }

          if (blockMessageCount >= currentBlockSize && i < remainingIds.length) {
            blocksCompleted++;
            updateDispatch(dispatchId, { blocksSent: blocksCompleted });
            const breathingMs = ANTI_BAN_BREATHING_MS + randomBetween(0, 2 * 60 * 1000);
            toast.info(`☕ Bloco de ${currentBlockSize} enviado (${blocksCompleted}º). Respirando...`, { id: `dispatch-breathing-${dispatchId}`, duration: 10000 });
            await breathingWait(dispatchId, breathingMs, updateDispatch, controlsRef);
            const ctrl2 = controlsRef.current[dispatchId];
            if (ctrl2?.isCancelled) break;
            blockMessageCount = 0;
            currentBlockSize = getJitteredBlockSize();
            consecutiveErrors = 0;
            if (!isWithinDispatchHours()) {
              const canContinue = await waitForDispatchWindow(dispatchId, updateDispatch, controlsRef);
              if (!canContinue) break;
            }
          }

          const contactId = remainingIds[i];
          const available = await contactStillAvailable(contactId);
          if (!available) {
            results.skipped++;
            i++;
            updateDispatch(dispatchId, { current: results.sent + results.failed + results.skipped });
            continue;
          }

          const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
            body: invokeBody([contactId]),
          });

          if (!sendError && result?.results) {
            results.sent += result.results.sent || 0;
            results.failed += result.results.failed || 0;
            if (result.results.errors) results.errors.push(...result.results.errors);
            if (result.results.errors?.some((e: string) => e.includes("Conta Business bloqueada"))) {
              toast.error("🛑 Conta Business bloqueada! Parando disparo imediatamente.", { duration: 30000 });
              break;
            }
            consecutiveErrors = 0;
          } else {
            results.failed++;
            consecutiveErrors++;
            if (sendError) results.errors.push(await getInvokeErrorMessage(sendError));
            if (consecutiveErrors >= 3) {
              toast.warning("🚨 3 erros consecutivos! Cooldown de emergência (5 min)...", { duration: 15000 });
              await breathingWait(dispatchId, 5 * 60 * 1000, updateDispatch, controlsRef);
              consecutiveErrors = 0;
              const ctrl3 = controlsRef.current[dispatchId];
              if (ctrl3?.isCancelled) break;
            }
          }

          blockMessageCount++;
          updateDispatch(dispatchId, {
            current: results.sent + results.failed + results.skipped,
            sent: results.sent, failed: results.failed, errors: [...results.errors],
            blocksSent: Math.floor((results.sent + results.failed) / ANTI_BAN_BLOCK_SIZE),
          });

          i++;
          if (i < remainingIds.length && !ctrl?.isCancelled) {
            let delayMs: number;
            if (randomJitter412) {
              delayMs = randomBetween(4000, 12000);
            } else {
              const baseUserDelayMs = intervalSeconds * 1000;
              const userJitterMs = Math.floor(baseUserDelayMs * (0.05 + Math.random() * 0.20));
              const userDelayMs = baseUserDelayMs + userJitterMs;
              const [pMin, pMax] = getProgressiveDelay(blocksCompleted, ANTI_BAN_MIN_DELAY_MS, ANTI_BAN_MAX_DELAY_MS);
              const antiBanDelayMs = randomBetween(pMin, Math.min(pMax, 15000));
              delayMs = Math.max(userDelayMs, antiBanDelayMs);
            }
            const waited = await resilientDelay(delayMs, () => controlsRef.current[dispatchId]);
            if (!waited) break;
          }
        }
      } else {
        // BATCH mode
        let batchBlockSize = getJitteredBlockSize();
        let i = 0;
        let chunkIndex = 0;
        while (i < remainingIds.length) {
          const ctrl = controlsRef.current[dispatchId];
          if (ctrl?.isCancelled) break;

          if (ctrl?.isPaused) {
            while (ctrl?.isPaused && !ctrl?.isCancelled) await new Promise((r) => setTimeout(r, 500));
            if (ctrl?.isCancelled) break;
            const freshIds = await fetchRemaining(listName, undefined, minIncome);
            remainingIds = freshIds;
            i = 0;
            updateDispatch(dispatchId, { total: results.sent + results.failed + results.skipped + remainingIds.length });
            if (remainingIds.length === 0) break;
            continue;
          }

          if (!isWithinDispatchHours()) {
            toast.info("⏰ Fora do horário (10-17h BRT, seg-sex). Aguardando...", { id: `dispatch-window-${dispatchId}`, duration: 15000 });
            const canContinue = await waitForDispatchWindow(dispatchId, updateDispatch, controlsRef);
            if (!canContinue) break;
            toast.success("✅ Janela de disparo aberta! Retomando...", { id: `dispatch-window-${dispatchId}`, duration: 5000 });
          }

          if (chunkIndex > 0) {
            updateDispatch(dispatchId, { blocksSent: chunkIndex });
            const breathingMs = ANTI_BAN_BREATHING_MS + randomBetween(0, 2 * 60 * 1000);
            toast.info(`☕ Bloco ${chunkIndex} de ${batchBlockSize} enviado. Respirando...`, { id: `dispatch-breathing-${dispatchId}`, duration: 10000 });
            await breathingWait(dispatchId, breathingMs, updateDispatch, controlsRef);
            const ctrl2 = controlsRef.current[dispatchId];
            if (ctrl2?.isCancelled) break;
            batchBlockSize = getJitteredBlockSize();
            if (!isWithinDispatchHours()) {
              const canContinue = await waitForDispatchWindow(dispatchId, updateDispatch, controlsRef);
              if (!canContinue) break;
            }
          }

          const chunk = remainingIds.slice(i, i + batchBlockSize);

          const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
            body: invokeBody(chunk),
          });

          if (!sendError && result?.results) {
            results.sent += result.results.sent || 0;
            results.failed += result.results.failed || 0;
            if (result.results.errors) results.errors.push(...result.results.errors);
            if (result.results.errors?.some((e: string) => e.includes("Conta Business bloqueada"))) {
              toast.error("🛑 Conta Business bloqueada! Parando disparo imediatamente.", { duration: 30000 });
              break;
            }
          } else {
            results.failed += chunk.length;
            results.errors.push(await getInvokeErrorMessage(sendError));
            const statusCode = (sendError as any)?.context?.status;
            if (statusCode === 401 || statusCode === 403) {
              updateDispatch(dispatchId, {
                current: results.sent + results.failed,
                sent: results.sent, failed: results.failed, errors: [...results.errors],
              });
              break;
            }
          }

          updateDispatch(dispatchId, {
            current: results.sent + results.failed,
            sent: results.sent, failed: results.failed, errors: [...results.errors],
            blocksSent: chunkIndex + 1,
          });

          i += batchBlockSize;
          chunkIndex++;
        }
      }

      const ctrl = controlsRef.current[dispatchId];
      if (ctrl?.isCancelled) {
        toast.warning(`${operatorDisplayName}: Cancelado — ${results.sent} enviados, ${results.failed} falhas`, { id: `dispatch-${dispatchId}`, duration: 10000 });
      } else if (results.failed > 0) {
        toast.error(`${operatorDisplayName}: Concluído com falhas — ${results.sent} enviados, ${results.failed} falhas`, { id: `dispatch-${dispatchId}`, duration: 15000 });
      } else {
        toast.success(`${operatorDisplayName}: Concluído — ${results.sent} enviados`, { id: `dispatch-${dispatchId}`, duration: 8000 });
      }
    } catch (err: any) {
      toast.error(`Erro no disparo (${operatorDisplayName})`, { description: err.message, duration: 15000 });
    } finally {
      updateDispatch(dispatchId, { isFinished: true, breathingUntil: undefined });
      delete controlsRef.current[dispatchId];
      onFinally?.();
    }
  })();
}
