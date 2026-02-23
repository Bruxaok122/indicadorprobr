import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MessageStats {
  total: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  sent: number;
}

export interface DailyStats {
  date: string;
  sent: number;
  failed: number;
  delivered: number;
}

export interface PhoneHealth {
  id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string | null;
  quality_rating: string | null;
  is_active: boolean;
  totalSent: number;
  totalFailed: number;
  totalDelivered: number;
  totalRead: number;
  successRate: number;
}

export interface ContactStats {
  total: number;
  novo: number;
  aguardando: number;
  respondido: number;
  encerrado: number;
  withUser: number;
  withoutUser: number;
}

export function useApiHealth() {
  // Message delivery stats
  const { data: messageStats, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["api-health-messages"],
    queryFn: async () => {
      const statuses = ["sent", "delivered", "read", "failed", "pending"];
      const results: Record<string, number> = {};

      const promises = statuses.map(async (status) => {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("direction", "outgoing")
          .eq("status", status);
        results[status] = count || 0;
      });

      const { count: totalCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "outgoing");

      await Promise.all(promises);

      return {
        total: totalCount || 0,
        sent: results.sent || 0,
        delivered: results.delivered || 0,
        read: results.read || 0,
        failed: results.failed || 0,
        pending: results.pending || 0,
      } as MessageStats;
    },
    refetchInterval: 30000, // refresh every 30s
  });

  // Daily stats for last 7 days
  const { data: dailyStats = [], isLoading: isLoadingDaily } = useQuery({
    queryKey: ["api-health-daily"],
    queryFn: async () => {
      const days: DailyStats[] = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
        const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();

        const [sentRes, failedRes, deliveredRes] = await Promise.all([
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("direction", "outgoing")
            .eq("status", "sent")
            .gte("created_at", startOfDay)
            .lt("created_at", endOfDay),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("direction", "outgoing")
            .eq("status", "failed")
            .gte("created_at", startOfDay)
            .lt("created_at", endOfDay),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("direction", "outgoing")
            .eq("status", "delivered")
            .gte("created_at", startOfDay)
            .lt("created_at", endOfDay),
        ]);

        days.push({
          date: date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }),
          sent: sentRes.count || 0,
          failed: failedRes.count || 0,
          delivered: deliveredRes.count || 0,
        });
      }

      return days;
    },
    refetchInterval: 60000,
  });

  // Per-phone health stats
  const { data: phoneHealth = [], isLoading: isLoadingPhones } = useQuery({
    queryKey: ["api-health-phones"],
    queryFn: async () => {
      const { data: phones, error } = await supabase
        .from("waba_phone_numbers")
        .select("*")
        .eq("is_active", true);

      if (error || !phones) return [];

      const results: PhoneHealth[] = [];

      for (const phone of phones) {
        const [sentRes, failedRes, deliveredRes, readRes] = await Promise.all([
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("direction", "outgoing")
            .eq("status", "sent"),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("direction", "outgoing")
            .eq("status", "failed"),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("direction", "outgoing")
            .eq("status", "delivered"),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("direction", "outgoing")
            .eq("status", "read"),
        ]);

        // We use contacts.dispatched_phone_number_id to attribute messages to phones
        const { count: phoneSent } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("dispatched_phone_number_id", phone.phone_number_id);

        const totalForPhone = phoneSent || 0;
        const total = (sentRes.count || 0) + (failedRes.count || 0) + (deliveredRes.count || 0) + (readRes.count || 0);

        results.push({
          ...phone,
          totalSent: totalForPhone,
          totalFailed: failedRes.count || 0,
          totalDelivered: deliveredRes.count || 0,
          totalRead: readRes.count || 0,
          successRate: total > 0 ? Math.round(((deliveredRes.count || 0) + (readRes.count || 0)) / total * 100) : 0,
        });
      }

      return results;
    },
    refetchInterval: 60000,
  });

  // Contact status breakdown
  const { data: contactStats, isLoading: isLoadingContacts } = useQuery({
    queryKey: ["api-health-contacts"],
    queryFn: async () => {
      const statusList = ["novo", "aguardando", "respondido", "encerrado"];
      const results: Record<string, number> = {};

      const promises = statusList.map(async (status) => {
        const { count } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        results[status] = count || 0;
      });

      const [totalRes, withUserRes, withoutUserRes] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id", { count: "exact", head: true }).not("user_id", "is", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).is("user_id", null),
        ...promises,
      ]);

      return {
        total: totalRes.count || 0,
        novo: results.novo || 0,
        aguardando: results.aguardando || 0,
        respondido: results.respondido || 0,
        encerrado: results.encerrado || 0,
        withUser: withUserRes.count || 0,
        withoutUser: withoutUserRes.count || 0,
      } as ContactStats;
    },
    refetchInterval: 30000,
  });

  // Incoming messages count (responses)
  const { data: incomingCount = 0 } = useQuery({
    queryKey: ["api-health-incoming"],
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "incoming");
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Templates sent today
  const { data: templatesSentToday = 0 } = useQuery({
    queryKey: ["api-health-templates-today"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "outgoing")
        .eq("message_type", "template")
        .gte("created_at", startOfDay.toISOString());
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const deliveryRate = messageStats
    ? messageStats.total > 0
      ? Math.round(((messageStats.delivered + messageStats.read) / messageStats.total) * 100)
      : 0
    : 0;

  const responseRate = messageStats
    ? messageStats.total > 0
      ? Math.round((incomingCount / messageStats.total) * 100)
      : 0
    : 0;

  return {
    messageStats,
    dailyStats,
    phoneHealth,
    contactStats,
    incomingCount,
    templatesSentToday,
    deliveryRate,
    responseRate,
    isLoading: isLoadingMessages || isLoadingDaily || isLoadingPhones || isLoadingContacts,
  };
}
