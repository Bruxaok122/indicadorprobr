import { useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ALARM_STORAGE_KEY = "quality-alarm-last-ratings";

function playAlarmSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Create a loud, attention-grabbing alarm (siren pattern)
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sawtooth";
      const startTime = now + i * 0.5;
      // Siren: alternate between two frequencies
      osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, startTime);
      osc.frequency.linearRampToValueAtTime(i % 2 === 0 ? 660 : 880, startTime + 0.45);

      gain.gain.setValueAtTime(0.6, startTime);
      gain.gain.linearRampToValueAtTime(0, startTime + 0.48);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    }

    // Close context after alarm finishes
    setTimeout(() => ctx.close(), 4000);
  } catch {
    // Fallback: try with Audio element
    console.warn("Web Audio API not available for alarm");
  }
}

interface PhoneQuality {
  id: string;
  display_phone_number: string;
  quality_rating: string | null;
}

export function useQualityAlarm(isAdmin: boolean) {
  const previousRatingsRef = useRef<Record<string, string>>({});
  const initializedRef = useRef(false);

  // Poll quality ratings every 30 seconds
  const { data: phones } = useQuery({
    queryKey: ["quality-alarm-monitor"],
    queryFn: async (): Promise<PhoneQuality[]> => {
      const { data, error } = await supabase
        .from("waba_phone_numbers")
        .select("id, display_phone_number, quality_rating")
        .eq("is_active", true);

      if (error || !data) return [];
      return data;
    },
    refetchInterval: 30000, // every 30s
    enabled: isAdmin,
  });

  const checkForDegradation = useCallback((currentPhones: PhoneQuality[]) => {
    const prev = previousRatingsRef.current;

    // On first load, just store current state
    if (!initializedRef.current) {
      initializedRef.current = true;
      const initial: Record<string, string> = {};
      for (const p of currentPhones) {
        if (p.quality_rating) initial[p.id] = p.quality_rating;
      }
      previousRatingsRef.current = initial;

      // Also check if any are already degraded on load
      for (const p of currentPhones) {
        if (p.quality_rating && p.quality_rating !== "GREEN") {
          playAlarmSound();
          toast.error(
            `⚠️ ALARME: Número ${p.display_phone_number} está com quality "${p.quality_rating}"!`,
            { duration: 15000 }
          );
        }
      }
      return;
    }

    // Compare with previous
    for (const phone of currentPhones) {
      const prevRating = prev[phone.id];
      const currentRating = phone.quality_rating;

      if (!currentRating) continue;

      // Detect degradation: was GREEN (or new), now YELLOW or RED
      if (
        currentRating !== "GREEN" &&
        (prevRating === "GREEN" || prevRating === undefined)
      ) {
        playAlarmSound();
        toast.error(
          `🚨 ALARME DE QUALITY! Número ${phone.display_phone_number} caiu de ${prevRating || "GREEN"} para ${currentRating}!`,
          { duration: 30000 }
        );
      }
      // Also alert if it went from YELLOW to RED
      else if (currentRating === "RED" && prevRating === "YELLOW") {
        playAlarmSound();
        toast.error(
          `🚨 ALARME CRÍTICO! Número ${phone.display_phone_number} caiu de AMARELO para VERMELHO!`,
          { duration: 30000 }
        );
      }
    }

    // Update stored ratings
    const updated: Record<string, string> = {};
    for (const p of currentPhones) {
      if (p.quality_rating) updated[p.id] = p.quality_rating;
    }
    previousRatingsRef.current = updated;
  }, []);

  useEffect(() => {
    if (phones && phones.length > 0) {
      checkForDegradation(phones);
    }
  }, [phones, checkForDegradation]);

  // Also subscribe to realtime changes for instant detection
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("quality-alarm")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "waba_phone_numbers",
        },
        (payload) => {
          const newRow = payload.new as PhoneQuality;
          const oldRow = payload.old as PhoneQuality;

          if (
            oldRow.quality_rating === "GREEN" &&
            newRow.quality_rating &&
            newRow.quality_rating !== "GREEN"
          ) {
            playAlarmSound();
            toast.error(
              `🚨 ALARME! Quality do número ${newRow.display_phone_number} mudou para ${newRow.quality_rating}!`,
              { duration: 30000 }
            );
          } else if (
            oldRow.quality_rating === "YELLOW" &&
            newRow.quality_rating === "RED"
          ) {
            playAlarmSound();
            toast.error(
              `🚨 ALARME CRÍTICO! Número ${newRow.display_phone_number} caiu para VERMELHO!`,
              { duration: 30000 }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);
}
