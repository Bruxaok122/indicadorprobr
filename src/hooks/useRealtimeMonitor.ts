import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Aggregated realtime monitoring data for the admin panel.
 *
 * Strategy: a single hook that fetches all the slim data needed (operators,
 * contacts with last_message_at, recent messages window) and computes
 * derived metrics client-side. Polls every 5s.
 */

export interface OperatorActivity {
  user_id: string;
  full_name: string;
  email: string;
  is_blocked: boolean;
  last_login_at: string | null;
  // Derived
  active_chats: number;            // contacts with last_message_at in last 24h
  msgs_sent_today: number;
  msgs_received_today: number;
  last_activity_at: string | null; // most recent message timestamp (in or out)
  is_live: boolean;                // had any message in last 5 min
}

export interface ActiveChatRow {
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  operator_id: string | null;
  operator_name: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  status: string | null;
  ai_enabled: boolean;
  unread_from_client: number;      // incoming messages in last 24h
  minutes_since_last: number | null;
}

export interface RealtimeStats {
  operators_total: number;
  operators_live: number;          // active in last 5 min
  active_chats_total: number;      // contacts with msg in last 24h
  msgs_in_today: number;
  msgs_out_today: number;
  pending_responses: number;       // contacts whose last message is incoming + > 0 min ago
}

interface RealtimeData {
  stats: RealtimeStats;
  operators: OperatorActivity[];
  chats: ActiveChatRow[];
}

const startOfTodayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export function useRealtimeMonitor() {
  return useQuery<RealtimeData>({
    queryKey: ["realtime-monitor"],
    queryFn: async () => {
      const todayISO = startOfTodayISO();
      const last24hISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;

      // Fetch in parallel
      const [profilesRes, rolesRes, contactsRes, msgsTodayRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, email, is_blocked, last_login_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("contacts")
          .select(
            "id, name, phone, user_id, status, ai_enabled, last_message_at, last_message_preview"
          )
          .gte("last_message_at", last24hISO)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(500),
        supabase
          .from("messages")
          .select("user_id, contact_id, direction, created_at")
          .gte("created_at", todayISO)
          .limit(5000),
      ]);

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];
      const contacts = contactsRes.data || [];
      const msgs = msgsTodayRes.data || [];

      const adminIds = new Set(
        roles.filter((r: any) => r.role === "admin").map((r: any) => r.user_id)
      );
      const operatorProfiles = profiles.filter((p: any) => !adminIds.has(p.user_id));

      // Build operator name map (include admins for display in chat rows)
      const nameById = new Map<string, string>();
      profiles.forEach((p: any) => nameById.set(p.user_id, p.full_name));

      // Index messages by operator + by contact
      const lastActivityByOperator = new Map<string, number>();
      const sentByOperator = new Map<string, number>();
      const recvByOperator = new Map<string, number>();
      const incomingByContact = new Map<string, number>();
      const lastDirByContact = new Map<string, "incoming" | "outgoing">();
      const lastTsByContact = new Map<string, number>();

      let msgsInToday = 0;
      let msgsOutToday = 0;

      for (const m of msgs as any[]) {
        const ts = new Date(m.created_at).getTime();
        if (m.direction === "outgoing") {
          msgsOutToday++;
          if (m.user_id) {
            sentByOperator.set(m.user_id, (sentByOperator.get(m.user_id) || 0) + 1);
            const prev = lastActivityByOperator.get(m.user_id) || 0;
            if (ts > prev) lastActivityByOperator.set(m.user_id, ts);
          }
        } else if (m.direction === "incoming") {
          msgsInToday++;
          if (m.user_id) {
            recvByOperator.set(m.user_id, (recvByOperator.get(m.user_id) || 0) + 1);
          }
          if (m.contact_id) {
            incomingByContact.set(
              m.contact_id,
              (incomingByContact.get(m.contact_id) || 0) + 1
            );
          }
        }
        if (m.contact_id) {
          const prev = lastTsByContact.get(m.contact_id) || 0;
          if (ts > prev) {
            lastTsByContact.set(m.contact_id, ts);
            lastDirByContact.set(m.contact_id, m.direction);
          }
        }
      }

      // Build operators array
      const operators: OperatorActivity[] = operatorProfiles.map((p: any) => {
        const lastTs = lastActivityByOperator.get(p.user_id) || 0;
        const activeChats = contacts.filter((c: any) => c.user_id === p.user_id).length;
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          is_blocked: !!p.is_blocked,
          last_login_at: p.last_login_at || null,
          active_chats: activeChats,
          msgs_sent_today: sentByOperator.get(p.user_id) || 0,
          msgs_received_today: recvByOperator.get(p.user_id) || 0,
          last_activity_at: lastTs ? new Date(lastTs).toISOString() : null,
          is_live: lastTs > fiveMinAgo,
        };
      });
      // Sort: live first, then by last activity desc
      operators.sort((a, b) => {
        if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
        const at = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const bt = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        return bt - at;
      });

      // Build chat rows
      const now = Date.now();
      const chats: ActiveChatRow[] = contacts.map((c: any) => {
        const lastTs = c.last_message_at ? new Date(c.last_message_at).getTime() : null;
        const minutesSince = lastTs ? Math.floor((now - lastTs) / 60000) : null;
        return {
          contact_id: c.id,
          contact_name: c.name,
          contact_phone: c.phone,
          operator_id: c.user_id,
          operator_name: c.user_id
            ? nameById.get(c.user_id) || "—"
            : "Pool (sem dono)",
          last_message_at: c.last_message_at,
          last_message_preview: c.last_message_preview,
          status: c.status,
          ai_enabled: !!c.ai_enabled,
          unread_from_client: incomingByContact.get(c.id) || 0,
          minutes_since_last: minutesSince,
        };
      });

      const pendingResponses = contacts.filter(
        (c: any) => lastDirByContact.get(c.id) === "incoming"
      ).length;

      const stats: RealtimeStats = {
        operators_total: operatorProfiles.length,
        operators_live: operators.filter((o) => o.is_live).length,
        active_chats_total: contacts.length,
        msgs_in_today: msgsInToday,
        msgs_out_today: msgsOutToday,
        pending_responses: pendingResponses,
      };

      return { stats, operators, chats };
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });
}
