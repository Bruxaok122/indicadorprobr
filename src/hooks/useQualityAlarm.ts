import { useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function playAlarmSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Loud siren alarm pattern
    for (let i = 0; i < 8; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sawtooth";
      const startTime = now + i * 0.45;
      osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, startTime);
      osc.frequency.linearRampToValueAtTime(i % 2 === 0 ? 660 : 880, startTime + 0.4);

      gain.gain.setValueAtTime(0.7, startTime);
      gain.gain.linearRampToValueAtTime(0, startTime + 0.43);

      osc.start(startTime);
      osc.stop(startTime + 0.45);
    }

    setTimeout(() => ctx.close(), 5000);
  } catch {
    console.warn("Web Audio API not available for alarm");
  }
}

interface PhoneQuality {
  id: string;
  display_phone_number: string;
  quality_rating: string | null;
}

interface AccountQuality {
  account: {
    id: string;
    name: string;
    status: string;
    quality: string | null;
    message_template_quality: string | null;
    ban_info: any;
  };
  phones: {
    id: string;
    display_phone_number: string;
    quality_rating: string | null;
    status: string | null;
    name_status: string | null;
  }[];
}

export function useQualityAlarm(isAdmin: boolean) {
  const previousPhoneRatingsRef = useRef<Record<string, string>>({});
  const previousAccountStatusRef = useRef<string | null>(null);
  const previousPhoneStatusesRef = useRef<Record<string, string>>({});
  const initializedRef = useRef(false);

  // Poll phone quality from local DB every 30s
  const { data: localPhones } = useQuery({
    queryKey: ["quality-alarm-local"],
    queryFn: async (): Promise<PhoneQuality[]> => {
      const { data, error } = await supabase
        .from("waba_phone_numbers")
        .select("id, display_phone_number, quality_rating")
        .eq("is_active", true);
      if (error || !data) return [];
      return data;
    },
    refetchInterval: 30000,
    enabled: isAdmin,
  });

  // Poll Meta API for full account + phone quality every 60s
  const { data: metaQuality } = useQuery({
    queryKey: ["quality-alarm-meta"],
    queryFn: async (): Promise<AccountQuality | null> => {
      try {
        const { data, error } = await supabase.functions.invoke("check-waba-quality");
        if (error) return null;
        return data as AccountQuality;
      } catch {
        return null;
      }
    },
    refetchInterval: 60000, // every 60s from Meta
    enabled: isAdmin,
  });

  // Check account-level degradation
  useEffect(() => {
    if (!metaQuality) return;

    const { account, phones } = metaQuality;

    // Account status check
    const prevAccountStatus = previousAccountStatusRef.current;
    const accountOk = ["APPROVED", "UNKNOWN"].includes(account.status);

    if (prevAccountStatus !== null && !accountOk && ["APPROVED", "UNKNOWN"].includes(prevAccountStatus)) {
      playAlarmSound();
      toast.error(
        `🚨 ALARME DA CONTA! Status da conta WABA mudou para "${account.status}"! ${account.ban_info ? JSON.stringify(account.ban_info) : ""}`,
        { duration: 30000 }
      );
    } else if (prevAccountStatus === null && !accountOk) {
      // First load and already bad
      playAlarmSound();
      toast.error(
        `⚠️ ALARME: Conta WABA com status "${account.status}"!`,
        { duration: 15000 }
      );
    }
    previousAccountStatusRef.current = account.status;

    // Phone quality check from Meta API (more accurate than local DB)
    const prevPhoneStatuses = previousPhoneStatusesRef.current;
    for (const phone of phones) {
      const prevStatus = prevPhoneStatuses[phone.id];
      const currentStatus = phone.status;

      // Phone went offline/flagged
      if (
        currentStatus &&
        !["CONNECTED", "READY"].includes(currentStatus) &&
        (prevStatus === undefined || ["CONNECTED", "READY"].includes(prevStatus))
      ) {
        playAlarmSound();
        toast.error(
          `🚨 ALARME! Número ${phone.display_phone_number} mudou para status "${currentStatus}"!`,
          { duration: 30000 }
        );
      }
    }

    // Update previous statuses
    const updated: Record<string, string> = {};
    for (const p of phones) {
      if (p.status) updated[p.id] = p.status;
    }
    previousPhoneStatusesRef.current = updated;
  }, [metaQuality]);

  // Check local phone quality changes (faster detection via realtime)
  const checkPhoneQuality = useCallback((currentPhones: PhoneQuality[]) => {
    const prev = previousPhoneRatingsRef.current;

    if (!initializedRef.current) {
      initializedRef.current = true;
      const initial: Record<string, string> = {};
      for (const p of currentPhones) {
        if (p.quality_rating) initial[p.id] = p.quality_rating;
      }
      previousPhoneRatingsRef.current = initial;

      // Alert if already degraded
      for (const p of currentPhones) {
        if (p.quality_rating && p.quality_rating !== "GREEN") {
          playAlarmSound();
          toast.error(
            `⚠️ ALARME: Número ${p.display_phone_number} com quality "${p.quality_rating}"!`,
            { duration: 15000 }
          );
        }
      }
      return;
    }

    for (const phone of currentPhones) {
      const prevRating = prev[phone.id];
      const currentRating = phone.quality_rating;
      if (!currentRating) continue;

      if (currentRating !== "GREEN" && (prevRating === "GREEN" || prevRating === undefined)) {
        playAlarmSound();
        toast.error(
          `🚨 ALARME! Número ${phone.display_phone_number} caiu de ${prevRating || "GREEN"} para ${currentRating}!`,
          { duration: 30000 }
        );
      } else if (currentRating === "RED" && prevRating === "YELLOW") {
        playAlarmSound();
        toast.error(
          `🚨 ALARME CRÍTICO! Número ${phone.display_phone_number} caiu para VERMELHO!`,
          { duration: 30000 }
        );
      }
    }

    const updatedRatings: Record<string, string> = {};
    for (const p of currentPhones) {
      if (p.quality_rating) updatedRatings[p.id] = p.quality_rating;
    }
    previousPhoneRatingsRef.current = updatedRatings;
  }, []);

  useEffect(() => {
    if (localPhones && localPhones.length > 0) {
      checkPhoneQuality(localPhones);
    }
  }, [localPhones, checkPhoneQuality]);

  // Realtime: instant detection of DB changes
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("quality-alarm")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "waba_phone_numbers" },
        (payload) => {
          const newRow = payload.new as PhoneQuality;
          const oldRow = payload.old as PhoneQuality;

          if (oldRow.quality_rating === "GREEN" && newRow.quality_rating && newRow.quality_rating !== "GREEN") {
            playAlarmSound();
            toast.error(
              `🚨 ALARME! Quality do número ${newRow.display_phone_number} mudou para ${newRow.quality_rating}!`,
              { duration: 30000 }
            );
          } else if (oldRow.quality_rating === "YELLOW" && newRow.quality_rating === "RED") {
            playAlarmSound();
            toast.error(
              `🚨 ALARME CRÍTICO! Número ${newRow.display_phone_number} caiu para VERMELHO!`,
              { duration: 30000 }
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "api_configs" },
        (payload) => {
          const newRow = payload.new as { status_message?: string };
          if (newRow.status_message && newRow.status_message.startsWith("⚠️")) {
            playAlarmSound();
            toast.error(
              `🚨 ALARME DA CONTA! ${newRow.status_message}`,
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
