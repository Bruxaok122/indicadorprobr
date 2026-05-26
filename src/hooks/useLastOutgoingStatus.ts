import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LastOutgoingStatus = "pending" | "sent" | "delivered" | "read" | "failed" | "failed_no_whatsapp";

// Meta error codes that indicate the recipient does not have WhatsApp
const NO_WHATSAPP_ERROR_CODES = new Set(["131026"]);

/**
 * Returns a map of contact_id -> status of the latest outgoing message for that contact.
 * Used to render WhatsApp-like ticks (✓, ✓✓, ✓✓ azul) on contact cards.
 */
export function useLastOutgoingStatus(contactIds: string[]) {
  const [statusMap, setStatusMap] = useState<Record<string, LastOutgoingStatus>>({});

  // Stable key so we don't refetch on every render
  const key = contactIds.slice().sort().join(",");

  useEffect(() => {
    if (!contactIds.length) {
      setStatusMap({});
      return;
    }

    let cancelled = false;

    const fetchStatuses = async () => {
      // Fetch recent outgoing messages for these contacts (limit broad, then reduce)
      const { data, error } = await supabase
        .from("messages")
        .select("contact_id, status, created_at")
        .in("contact_id", contactIds)
        .eq("direction", "outgoing")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error || cancelled || !data) return;

      const map: Record<string, LastOutgoingStatus> = {};
      for (const m of data as any[]) {
        if (!map[m.contact_id]) {
          map[m.contact_id] = m.status as LastOutgoingStatus;
        }
      }
      setStatusMap(map);
    };

    fetchStatuses();

    // Realtime: update when message status changes
    const channel = supabase
      .channel("contact-last-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => fetchStatuses()
      )
      .subscribe();

    // Polling fallback every 8s
    const interval = setInterval(fetchStatuses, 8000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return statusMap;
}
