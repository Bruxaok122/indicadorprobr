import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FINAL_STAGES = ["pronto_para_compliance", "compliance_confirmado"];

function playSuccessSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Pleasant two-tone chime
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.5);
    });
  } catch {
    // AudioContext may not be available
  }
}

export function useAICompletionAlert() {
  const knownFinalIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase
      .channel("ai-completion-alert")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "contacts",
        },
        (payload) => {
          const newRow = payload.new as any;
          if (
            FINAL_STAGES.includes(newRow.ai_stage) &&
            !knownFinalIds.current.has(newRow.id)
          ) {
            knownFinalIds.current.add(newRow.id);
            playSuccessSound();
            toast.success(`✅ Ficha completa: ${newRow.name}`, {
              duration: 3000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
