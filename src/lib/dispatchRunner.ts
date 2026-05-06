import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ActiveDispatch } from "@/contexts/DispatchContext";
import { resilientDelay } from "@/lib/resilientDelay";

interface DispatchControls {
  isPaused: boolean;
  isCancelled: boolean;
}

interface DispatchResults {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export type PersistentDispatchKind = "auto" | "smart" | "conservative";

export interface PersistedDispatchJob {
  id: string;
  kind: PersistentDispatchKind;
  contactIds: string[];
  templateName: string;
  templateLanguage?: string;
  userId: string;
  assignedUserId: string | null;
  selectedPhoneNumberId?: string;
  variableMappings?: Record<string, string>;
  phoneVerifiedName?: string;
  dispatchMode: "shared" | "private";
  intervalSeconds?: number;
  baseIntervalSec?: number;
  nextIndex: number;
  results: DispatchResults;
}

interface RunDispatchOptions {
  updateDispatch: (dispatchId: string, updates: Partial<ActiveDispatch>) => void;
  getControls: () => DispatchControls | undefined;
  onComplete?: () => void;
}

const STORAGE_PREFIX = "juriszap.dispatch.job.";
const runningDispatches = new Set<string>();

export function saveDispatchJob(job: PersistedDispatchJob) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_PREFIX}${job.id}`, JSON.stringify(job));
}

export function getDispatchJob(dispatchId: string): PersistedDispatchJob | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${dispatchId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedDispatchJob;
    if (!parsed?.id || !Array.isArray(parsed.contactIds)) return null;
    return {
      ...parsed,
      nextIndex: parsed.nextIndex || 0,
      results: parsed.results || { sent: 0, failed: 0, skipped: 0, errors: [] },
    };
  } catch {
    return null;
  }
}

export function removeDispatchJob(dispatchId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${STORAGE_PREFIX}${dispatchId}`);
  runningDispatches.delete(dispatchId);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getBrtMinutes() {
  const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return nowBrt.getHours() * 60 + nowBrt.getMinutes();
}

function waitUntilBusinessWindow(job: PersistedDispatchJob) {
  const timeInMinutes = getBrtMinutes();

  if (job.kind === "smart") {
    const morningStart = 8 * 60;
    const morningEnd = 11 * 60 + 30;
    const afternoonStart = 13 * 60 + 30;
    const afternoonEnd = 17 * 60;
    const inWindow =
      (timeInMinutes >= morningStart && timeInMinutes < morningEnd) ||
      (timeInMinutes >= afternoonStart && timeInMinutes < afternoonEnd);
    if (inWindow) return 0;
    if (timeInMinutes < morningStart) return morningStart - timeInMinutes;
    if (timeInMinutes >= morningEnd && timeInMinutes < afternoonStart) return afternoonStart - timeInMinutes;
    return 24 * 60 - timeInMinutes + morningStart;
  }

  if (job.kind === "conservative") {
    const windowStart = 9 * 60;
    const windowEnd = 17 * 60;
    if (timeInMinutes >= windowStart && timeInMinutes < windowEnd) return 0;
    return timeInMinutes < windowStart ? windowStart - timeInMinutes : 24 * 60 - timeInMinutes + windowStart;
  }

  return 0;
}

function getDelayMs(job: PersistedDispatchJob, totalSentInSession: number, currentPhase: number) {
  if (job.kind === "smart") {
    const phases = [
      { minDelay: 45, maxDelay: 90 },
      { minDelay: 25, maxDelay: 50 },
      { minDelay: 15, maxDelay: 35 },
      { minDelay: 10, maxDelay: 20 },
    ];
    const phase = phases[currentPhase] || phases[0];
    return randomBetween(phase.minDelay, phase.maxDelay) * 1000;
  }

  if (job.kind === "conservative") {
    const baseDelayMs = Math.max(job.baseIntervalSec || 90, 90) * 1000;
    const jitterMs = Math.floor(baseDelayMs * (0.1 + Math.random() * 0.2));
    return baseDelayMs + jitterMs;
  }

  const safeBase = Math.max(job.intervalSeconds || 65, 60);
  const baseDelayMs = safeBase * 1000;
  const jitterMs = Math.floor(baseDelayMs * (0.05 + Math.random() * 0.2));
  return baseDelayMs + jitterMs;
}

async function waitWhilePaused(getControls: () => DispatchControls | undefined) {
  let ctrl = getControls();
  while (ctrl?.isPaused && !ctrl?.isCancelled) {
    await new Promise((r) => setTimeout(r, 500));
    ctrl = getControls();
  }
  return !ctrl?.isCancelled;
}

export async function runPersistentDispatch(jobInput: PersistedDispatchJob, options: RunDispatchOptions) {
  if (runningDispatches.has(jobInput.id)) return;
  runningDispatches.add(jobInput.id);

  let job = getDispatchJob(jobInput.id) || jobInput;
  let results = job.results || { sent: 0, failed: 0, skipped: 0, errors: [] };
  let consecutiveErrors = 0;
  let currentPhase = 0;
  let msgsInCurrentPhase = 0;
  let totalSentInSession = 0;

  try {
    for (let i = Math.max(job.nextIndex || 0, 0); i < job.contactIds.length; i++) {
      const ctrl = options.getControls();
      if (ctrl?.isCancelled) break;
      if (ctrl?.isPaused) {
        const shouldContinue = await waitWhilePaused(options.getControls);
        if (!shouldContinue) break;
      }

      const waitMinutes = waitUntilBusinessWindow(job);
      if (waitMinutes > 0) {
        const until = new Date(Date.now() + waitMinutes * 60 * 1000).toISOString();
        options.updateDispatch(job.id, { breathingUntil: until });
        const waited = await resilientDelay(waitMinutes * 60 * 1000, options.getControls, 10000);
        options.updateDispatch(job.id, { breathingUntil: undefined });
        if (!waited) break;
      }

      const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
        body: {
          contactIds: [job.contactIds[i]],
          templateName: job.templateName,
          templateLanguage: job.templateLanguage,
          userId: job.userId,
          assignedUserId: job.assignedUserId,
          selectedPhoneNumberId: job.selectedPhoneNumberId,
          variableMappings: job.variableMappings,
          phoneVerifiedName: job.phoneVerifiedName,
          dispatchMode: job.dispatchMode,
        },
      });

      if (!sendError && result?.results) {
        results.sent += result.results.sent || 0;
        results.failed += result.results.failed || 0;
        results.skipped += result.results.skipped || 0;
        if (result.results.errors) results.errors.push(...result.results.errors);

        const hasBlockError = result.results.errors?.some((e: string) =>
          e.includes("Conta Business bloqueada") || e.includes("131031") || e.includes("131051") || e.includes("131042") || e.includes("131056")
        );
        if (hasBlockError && job.kind === "conservative") break;
        if (hasBlockError && job.kind === "smart") {
          currentPhase = Math.max(0, currentPhase - 1);
          msgsInCurrentPhase = 0;
          options.updateDispatch(job.id, { breathingUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
          const waited = await resilientDelay(5 * 60 * 1000, options.getControls, 10000);
          options.updateDispatch(job.id, { breathingUntil: undefined });
          if (!waited) break;
        }

        if ((result.results.sent || 0) > 0) {
          consecutiveErrors = 0;
          totalSentInSession++;
          msgsInCurrentPhase++;
        }
      } else {
        results.failed++;
        consecutiveErrors++;
        results.errors.push(sendError?.message || "Erro desconhecido");
      }

      job = { ...job, nextIndex: i + 1, results };
      saveDispatchJob(job);
      options.updateDispatch(job.id, {
        current: results.sent + results.failed + results.skipped,
        sent: results.sent,
        failed: results.failed,
        errors: [...results.errors],
      });

      const totalProcessed = results.sent + results.failed;
      if (job.kind === "smart" && totalProcessed > 10 && (results.failed / totalProcessed) * 100 > 3) {
        options.updateDispatch(job.id, { breathingUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
        const waited = await resilientDelay(15 * 60 * 1000, options.getControls, 10000);
        options.updateDispatch(job.id, { breathingUntil: undefined });
        if (!waited) break;
      }
      if (job.kind === "conservative" && totalProcessed > 10 && (results.failed / totalProcessed) * 100 > 2) {
        options.updateDispatch(job.id, { breathingUntil: new Date(Date.now() + 20 * 60 * 1000).toISOString() });
        const waited = await resilientDelay(20 * 60 * 1000, options.getControls, 10000);
        options.updateDispatch(job.id, { breathingUntil: undefined });
        if (!waited) break;
      }
      if (consecutiveErrors >= (job.kind === "conservative" ? 2 : 3)) {
        const cooldownMs = job.kind === "conservative" ? 10 * 60 * 1000 : 5 * 60 * 1000;
        options.updateDispatch(job.id, { breathingUntil: new Date(Date.now() + cooldownMs).toISOString() });
        const waited = await resilientDelay(cooldownMs, options.getControls, 10000);
        options.updateDispatch(job.id, { breathingUntil: undefined });
        consecutiveErrors = 0;
        if (!waited) break;
      }

      if (job.kind === "smart" && msgsInCurrentPhase >= [20, 30, 50, Number.POSITIVE_INFINITY][currentPhase] && currentPhase < 3) {
        currentPhase++;
        msgsInCurrentPhase = 0;
      }

      const breathingEvery = job.kind === "smart" ? 2 * 60 * 1000 : job.kind === "conservative" ? 4 * 60 * 1000 : 0;
      if (breathingEvery > 0 && totalSentInSession > 0 && totalSentInSession % 30 === 0) {
        options.updateDispatch(job.id, { breathingUntil: new Date(Date.now() + breathingEvery).toISOString() });
        const waited = await resilientDelay(breathingEvery, options.getControls, 10000);
        options.updateDispatch(job.id, { breathingUntil: undefined });
        if (!waited) break;
      }

      if (i < job.contactIds.length - 1 && !options.getControls()?.isCancelled) {
        const delayMs = getDelayMs(job, totalSentInSession, currentPhase);
        options.updateDispatch(job.id, { nextSendAt: new Date(Date.now() + delayMs).toISOString() });
        const waited = await resilientDelay(delayMs, options.getControls);
        options.updateDispatch(job.id, { nextSendAt: undefined });
        if (!waited) break;
      }
    }

    const ctrl = options.getControls();
    options.updateDispatch(job.id, { isFinished: true, isCancelled: !!ctrl?.isCancelled });
    removeDispatchJob(job.id);
    if (ctrl?.isCancelled) toast.warning(`Cancelado — ${results.sent} enviados, ${results.failed} falhas`);
    else if (results.failed > 0) toast.error(`Concluído com falhas — ${results.sent} enviados, ${results.failed} falhas`);
    else toast.success(`Disparo concluído — ${results.sent} enviados!`);
  } catch (err: any) {
    toast.error("Erro no disparo", { description: err.message });
    saveDispatchJob({ ...job, results });
  } finally {
    runningDispatches.delete(job.id);
    options.onComplete?.();
  }
}