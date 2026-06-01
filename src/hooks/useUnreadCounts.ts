import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

/**
 * Tracks unread incoming messages per contact for the current operator.
 *
 * Storage: localStorage key `unread:lastOpened:<userId>` -> { [contactId]: ISO string }
 * Counting: queries `messages` table for incoming messages newer than `last_opened_at`
 * for each visible contact. Polls every 8s to stay in sync with chat polling.
 */

const STORAGE_PREFIX = "unread:lastOpened:";

function readMap(userId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(userId: string, map: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function useUnreadCounts(contactIds: string[]) {
  const { user } = useAuthContext();
  const userId = user?.id;

  const [lastOpenedMap, setLastOpenedMap] = useState<Record<string, string>>(() =>
    userId ? readMap(userId) : {}
  );

  // Reload from storage when user changes
  useEffect(() => {
    if (userId) setLastOpenedMap(readMap(userId));
  }, [userId]);

  const idsKey = useMemo(() => contactIds.slice().sort().join(","), [contactIds]);

  // Query incoming messages count per contact, newer than last_opened_at
  // We fetch a slim list and aggregate client-side to keep payload small.
  const { data: countsRaw } = useQuery({
    queryKey: ["unread-counts", userId, idsKey],
    queryFn: async () => {
      if (!userId || contactIds.length === 0) return {} as Record<string, number>;

      // IMPORTANT: do NOT pass hundreds of UUIDs in .in() — it blows up the
      // URL length limit and PostgREST silently drops the filter or returns
      // empty (same bug that broke status ticks). RLS already scopes
      // messages to the operator, so fetch globally and reduce client-side.
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("messages")
        .select("contact_id, created_at")
        .eq("direction", "incoming")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(3000);

      if (error || !data) return {} as Record<string, number>;

      const idSet = new Set(contactIds);
      const counts: Record<string, number> = {};
      const currentMap = readMap(userId);
      for (const msg of data) {
        if (!idSet.has(msg.contact_id)) continue;
        const opened = currentMap[msg.contact_id];
        if (!opened || new Date(msg.created_at).getTime() > new Date(opened).getTime()) {
          counts[msg.contact_id] = (counts[msg.contact_id] || 0) + 1;
        }
      }
      return counts;
    },
    enabled: !!userId && contactIds.length > 0,
    refetchInterval: 8000,
    staleTime: 4000,
  });

  const counts = countsRaw || {};

  const markAsRead = useCallback(
    (contactId: string) => {
      if (!userId) return;
      const map = readMap(userId);
      map[contactId] = new Date().toISOString();
      writeMap(userId, map);
      setLastOpenedMap(map);
    },
    [userId]
  );

  return { counts, markAsRead, lastOpenedMap };
}
