import { useState, useRef, useCallback, useEffect } from "react";

const STORAGE_KEY = "notification-sound-enabled";

export function useNotificationSound() {
  const [enabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Default ON
    return saved === null ? true : saved === "true";
  });

  const audioContextRef = useRef<AudioContext | null>(null);

  const ensureContext = useCallback(async () => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Classic old phone "ring ring" — dual-tone 440Hz + 480Hz bursts, twice
  const playOldPhoneRing = useCallback(async () => {
    const ctx = await ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Two ring bursts separated by a short gap, mimicking "RING-RING"
    const burst = (offset: number) => {
      const duration = 0.45;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now + offset);
      master.gain.exponentialRampToValueAtTime(0.28, now + offset + 0.02);
      // Tremolo (bell-like pulsing)
      master.gain.setValueAtTime(0.28, now + offset + duration - 0.08);
      master.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      master.connect(ctx.destination);

      // Tremolo modulator ~20Hz for that mechanical bell vibration
      const tremolo = ctx.createOscillator();
      const tremoloGain = ctx.createGain();
      tremolo.frequency.setValueAtTime(20, now + offset);
      tremoloGain.gain.setValueAtTime(0.5, now + offset);
      tremolo.connect(tremoloGain);
      tremoloGain.connect(master.gain);
      tremolo.start(now + offset);
      tremolo.stop(now + offset + duration);

      // Two sine tones for the classic dual-tone ringer
      [440, 480].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + offset);
        osc.connect(master);
        osc.start(now + offset);
        osc.stop(now + offset + duration);
      });
    };

    burst(0);
    burst(0.55);
  }, [ensureContext]);

  useEffect(() => {
    const unlockAudio = async () => {
      try {
        await ensureContext();
      } catch {
        // ignore
      }
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [ensureContext]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const play = useCallback(() => {
    if (!enabled) return;
    playOldPhoneRing().catch(() => {
      // ignore
    });
  }, [enabled, playOldPhoneRing]);

  return { enabled, toggle, play };
}
