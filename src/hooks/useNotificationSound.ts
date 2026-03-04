import { useState, useRef, useCallback, useEffect } from "react";

const STORAGE_KEY = "notification-sound-enabled";

export function useNotificationSound() {
  const [enabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Default ON
    return saved === null ? true : saved === "true";
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("/sounds/notification.mp3");
    audioRef.current.volume = 0.7;
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const play = useCallback(() => {
    if (!enabled || !audioRef.current) return;
    // Reset and play
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      // Browser may block autoplay until user interaction — silently ignore
    });
  }, [enabled]);

  return { enabled, toggle, play };
}
