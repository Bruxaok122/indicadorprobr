/**
 * Meta WhatsApp Cloud API messaging tiers and safe dispatch intervals.
 *
 * Each tier represents the max **unique business-initiated conversations** per 24h.
 * We use a **70% safety margin** (balanced) over a **9h commercial window** by default,
 * to keep quality GREEN and avoid 131056 / 368 errors.
 *
 * Reference:
 * https://developers.facebook.com/docs/whatsapp/cloud-api/messaging-limits
 */

export type MessagingTier =
  | "TIER_50"
  | "TIER_250"
  | "TIER_1K"
  | "TIER_10K"
  | "TIER_100K"
  | "TIER_UNLIMITED"
  | "UNKNOWN";

export interface TierConfig {
  tier: MessagingTier;
  label: string;
  dailyCap: number; // max unique 24h convos
  /** Recommended interval (seconds) between sends for safe sustained throughput */
  recommendedIntervalSec: number;
  /** Hard floor — never go below this for this tier */
  minIntervalSec: number;
  /** Color hint for UI badge (semantic token) */
  variant: "muted" | "warning" | "success" | "primary" | "destructive";
}

const COMMERCIAL_WINDOW_HOURS = 9; // 8h-17h BRT
const SAFETY_RATIO = 0.7; // balanced: use 70% of daily cap

/**
 * Calculate recommended interval: cap × 0.7 messages spread across 9h.
 * Floor at safe per-tier minimum.
 */
function calcInterval(dailyCap: number, floorSec: number): number {
  const usableMsgs = Math.floor(dailyCap * SAFETY_RATIO);
  const windowSec = COMMERCIAL_WINDOW_HOURS * 3600;
  const ideal = Math.ceil(windowSec / Math.max(usableMsgs, 1));
  return Math.max(ideal, floorSec);
}

export const TIER_CONFIGS: Record<MessagingTier, TierConfig> = {
  TIER_50: {
    tier: "TIER_50",
    label: "Tier 50",
    dailyCap: 50,
    recommendedIntervalSec: calcInterval(50, 600), // ~10min floor
    minIntervalSec: 600,
    variant: "destructive",
  },
  TIER_250: {
    tier: "TIER_250",
    label: "Tier 250",
    dailyCap: 250,
    recommendedIntervalSec: calcInterval(250, 180), // ~3min floor
    minIntervalSec: 180,
    variant: "warning",
  },
  TIER_1K: {
    tier: "TIER_1K",
    label: "Tier 1K",
    dailyCap: 1000,
    recommendedIntervalSec: calcInterval(1000, 60),
    minIntervalSec: 60,
    variant: "primary",
  },
  TIER_10K: {
    tier: "TIER_10K",
    label: "Tier 10K",
    dailyCap: 10000,
    recommendedIntervalSec: calcInterval(10000, 10),
    minIntervalSec: 10,
    variant: "success",
  },
  TIER_100K: {
    tier: "TIER_100K",
    label: "Tier 100K",
    dailyCap: 100000,
    recommendedIntervalSec: calcInterval(100000, 3),
    minIntervalSec: 3,
    variant: "success",
  },
  TIER_UNLIMITED: {
    tier: "TIER_UNLIMITED",
    label: "Tier ∞",
    dailyCap: Number.MAX_SAFE_INTEGER,
    recommendedIntervalSec: 2,
    minIntervalSec: 1,
    variant: "success",
  },
  UNKNOWN: {
    tier: "UNKNOWN",
    label: "Tier ?",
    dailyCap: 250,
    recommendedIntervalSec: 180,
    minIntervalSec: 120,
    variant: "muted",
  },
};

/**
 * Normalize a Meta API tier string into our enum.
 * Meta returns: "TIER_50", "TIER_250", "TIER_1K", "TIER_10K", "TIER_100K", "TIER_UNLIMITED"
 */
export function normalizeTier(raw: string | null | undefined): MessagingTier {
  if (!raw) return "UNKNOWN";
  const upper = raw.toUpperCase().trim();
  if (upper in TIER_CONFIGS) return upper as MessagingTier;
  // Fallback aliases
  if (upper.includes("UNLIMITED")) return "TIER_UNLIMITED";
  if (upper.includes("100K") || upper.includes("100000")) return "TIER_100K";
  if (upper.includes("10K") || upper.includes("10000")) return "TIER_10K";
  if (upper.includes("1K") || upper === "TIER_1000") return "TIER_1K";
  if (upper.includes("250")) return "TIER_250";
  if (upper.includes("50")) return "TIER_50";
  return "UNKNOWN";
}

export function getTierConfig(tier: string | null | undefined): TierConfig {
  return TIER_CONFIGS[normalizeTier(tier)];
}
