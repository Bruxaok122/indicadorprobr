import { useCallback, useEffect, useState } from "react";

const COOLDOWN_MS = 25 * 60 * 1000; // 25 minutes
const STORAGE_PREFIX = "jz_last_dispatch_at_";

function storageKey(userId: string | undefined | null) {
  return `${STORAGE_PREFIX}${userId ?? "anon"}`;
}

export function useDispatchCooldown(userId: string | undefined | null, bypass: boolean = false) {
  const [lastAt, setLastAt] = useState<number>(() => {
    if (typeof window === "undefined" || !userId) return 0;
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? Number(raw) || 0 : 0;
  });
  const [now, setNow] = useState<number>(Date.now());

  // Sync stored value when user changes
  useEffect(() => {
    if (!userId) return;
    const raw = window.localStorage.getItem(storageKey(userId));
    setLastAt(raw ? Number(raw) || 0 : 0);
  }, [userId]);

  // Tick every second while we're inside the cooldown window
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // React to changes from other tabs
  useEffect(() => {
    if (!userId) return;
    const key = storageKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setLastAt(e.newValue ? Number(e.newValue) || 0 : 0);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  const elapsed = lastAt ? now - lastAt : COOLDOWN_MS;
  const remainingMs = Math.max(0, COOLDOWN_MS - elapsed);
  const isReady = remainingMs <= 0;

  const markDispatched = useCallback(() => {
    if (!userId) return;
    const ts = Date.now();
    window.localStorage.setItem(storageKey(userId), String(ts));
    setLastAt(ts);
  }, [userId]);

  return { isReady, remainingMs, markDispatched };
}

export function formatCooldown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
