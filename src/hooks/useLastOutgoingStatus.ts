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

    const idSet = new Set(contactIds);
    let cancelled = false;

    const fetchStatuses = async () => {
      // IMPORTANT: do NOT pass hundreds of UUIDs in .in() — it blows up the
      // URL length limit and PostgREST silently drops the filter or returns
      // empty. RLS already scopes outgoing messages to the current operator,
      // so fetch globally and reduce client-side.
      const { data, error } = await supabase
        .from("messages")
        .select("contact_id, status, error_code, created_at")
        .eq("direction", "outgoing")
        .order("created_at", { ascending: false })
        .limit(3000);

      if (error || cancelled || !data) return;

      const map: Record<string, LastOutgoingStatus> = {};
      for (const m of data as any[]) {
        if (!idSet.has(m.contact_id)) continue;
        if (!map[m.contact_id]) {
          let st = m.status as LastOutgoingStatus;
          if (st === "failed" && m.error_code && NO_WHATSAPP_ERROR_CODES.has(String(m.error_code))) {
            st = "failed_no_whatsapp";
          }
          map[m.contact_id] = st;
        }
      }
      setStatusMap(map);
    };

    fetchStatuses();

    const channel = supabase
      .channel("contact-last-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => fetchStatuses()
      )
      .subscribe();

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
