/**
 * Resilient delay utility for dispatch loops.
 *
 * Browser tabs throttle setTimeout to ~1s (or even 1/min) when in the background.
 * The old pattern of splitting a 100s delay into 200 x 500ms chunks means each
 * chunk gets throttled, causing the total wait to balloon to minutes or even hours.
 *
 * This utility tracks **wall-clock elapsed time** instead of counting iterations,
 * so the delay finishes on time even when the tab is backgrounded.
 */

interface DispatchControls {
  isPaused: boolean;
  isCancelled: boolean;
}

/**
 * Wait for `delayMs` milliseconds while respecting pause/cancel controls.
 * Uses wall-clock time so browser timer throttling doesn't extend the wait.
 *
 * @returns `true` if waited the full duration, `false` if cancelled.
 */
export async function resilientDelay(
  delayMs: number,
  getControls: () => DispatchControls | undefined,
  /** Check interval — how often we poll controls (default 2s) */
  checkIntervalMs = 2000,
): Promise<boolean> {
  const startedAt = Date.now();
  let pausedAccum = 0; // ms spent paused (extends deadline)

  while (true) {
    const ctrl = getControls();
    if (ctrl?.isCancelled) return false;

    // Handle pause: track how long we're paused
    if (ctrl?.isPaused) {
      const pauseStart = Date.now();
      while (ctrl?.isPaused && !ctrl?.isCancelled) {
        await new Promise((r) => setTimeout(r, checkIntervalMs));
      }
      if (ctrl?.isCancelled) return false;
      pausedAccum += Date.now() - pauseStart;
      continue; // re-check elapsed
    }

    const elapsed = Date.now() - startedAt - pausedAccum;
    if (elapsed >= delayMs) return true;

    // Sleep for the remaining time, capped at checkIntervalMs
    const remaining = delayMs - elapsed;
    const sleepFor = Math.min(remaining, checkIntervalMs);
    await new Promise((r) => setTimeout(r, sleepFor));
  }
}
