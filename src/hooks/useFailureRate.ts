import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FailureStats {
  totalSent: number;
  totalFailed: number;
  failureRate: number;
  blockErrors: number; // 131031, 131049, 131051
  unregisteredErrors: number; // 131026
  otherErrors: number;
  isAboveThreshold: boolean;
  lastUpdated: Date;
}

const THRESHOLD = 5; // 5%
const POLL_INTERVAL = 15_000; // 15s

export function useFailureRate(enabled = true) {
  const [stats, setStats] = useState<FailureStats>({
    totalSent: 0,
    totalFailed: 0,
    failureRate: 0,
    blockErrors: 0,
    unregisteredErrors: 0,
    otherErrors: 0,
    isAboveThreshold: false,
    lastUpdated: new Date(),
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      // Messages from last 2 hours
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const { data: messages } = await supabase
        .from("messages")
        .select("status, error_code")
        .eq("direction", "outgoing")
        .gte("created_at", since);

      if (!messages) return;

      const totalSent = messages.length;
      const failed = messages.filter((m) => m.status === "failed");
      const totalFailed = failed.length;

      const BLOCK_CODES = ["131031", "131049", "131051"];
      const blockErrors = failed.filter((m) => BLOCK_CODES.includes(m.error_code || "")).length;
      const unregisteredErrors = failed.filter((m) => m.error_code === "131026").length;
      const otherErrors = totalFailed - blockErrors - unregisteredErrors;

      const failureRate = totalSent > 0 ? (totalFailed / totalSent) * 100 : 0;

      setStats({
        totalSent,
        totalFailed,
        failureRate,
        blockErrors,
        unregisteredErrors,
        otherErrors,
        isAboveThreshold: failureRate >= THRESHOLD,
        lastUpdated: new Date(),
      });
    } catch (err) {
      console.error("Error fetching failure stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchStats();
    const interval = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [enabled, fetchStats]);

  return { stats, loading, refresh: fetchStats, THRESHOLD };
}
