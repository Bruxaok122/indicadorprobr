import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Saúde da API — escopo ESTRITO na API ativa (api_configs.is_active = true).
 * Mensagens contam apenas se o contato foi disparado por um número da API ativa
 * e se foram criadas depois que essa API foi cadastrada. Assim, dados de APIs
 * antigas nunca são atribuídos à nova.
 */

export interface PhoneHealth {
  id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string | null;
  quality_rating: string | null;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  successRate: number;
}

export interface DailyStats {
  date: string;
  entregues: number;
  falhas: number;
}

export interface ApiHealthData {
  apiName: string | null;
  since: string | null;
  total: number;
  delivered: number;
  read: number;
  failed: number;
  incoming: number;
  templatesToday: number;
  phones: PhoneHealth[];
  daily: DailyStats[];
}

const EMPTY: ApiHealthData = {
  apiName: null, since: null, total: 0, delivered: 0, read: 0, failed: 0,
  incoming: 0, templatesToday: 0, phones: [], daily: [],
};

export function useApiHealth() {
  const query = useQuery({
    queryKey: ["api-health-active"],
    refetchInterval: 60000,
    queryFn: async (): Promise<ApiHealthData> => {
      const { data: api } = await supabase
        .from("api_configs").select("id, name, created_at").eq("is_active", true).maybeSingle();
      if (!api) return EMPTY;

      const { data: phones } = await supabase
        .from("waba_phone_numbers")
        .select("id, phone_number_id, display_phone_number, verified_name, quality_rating")
        .eq("api_config_id", api.id).eq("is_active", true);
      const phoneList = phones || [];
      const ids = phoneList.map((p) => p.phone_number_id);
      if (ids.length === 0) return { ...EMPTY, apiName: api.name, since: api.created_at };

      // Contagem escopada: contato disparado por número da API ativa + após criação da API
      const count = async (opts: { direction: string; status?: string; phones?: string[]; from?: string; to?: string; template?: boolean }) => {
        let q = supabase
          .from("messages")
          .select("id, contacts!inner(dispatched_phone_number_id)", { count: "exact", head: true })
          .eq("direction", opts.direction)
          .in("contacts.dispatched_phone_number_id", opts.phones || ids)
          .gte("created_at", opts.from && opts.from > api.created_at ? opts.from : api.created_at);
        if (opts.status) q = q.eq("status", opts.status);
        if (opts.to) q = q.lt("created_at", opts.to);
        if (opts.template) q = q.eq("message_type", "template");
        const { count: c } = await q;
        return c || 0;
      };

      const today = new Date(); today.setHours(0, 0, 0, 0);

      const [total, delivered, read, failed, incoming, templatesToday] = await Promise.all([
        count({ direction: "outgoing" }),
        count({ direction: "outgoing", status: "delivered" }),
        count({ direction: "outgoing", status: "read" }),
        count({ direction: "outgoing", status: "failed" }),
        count({ direction: "incoming" }),
        count({ direction: "outgoing", template: true, from: today.toISOString() }),
      ]);

      const phoneStats = await Promise.all(phoneList.map(async (p) => {
        const [s, d, r, f] = await Promise.all([
          count({ direction: "outgoing", phones: [p.phone_number_id] }),
          count({ direction: "outgoing", status: "delivered", phones: [p.phone_number_id] }),
          count({ direction: "outgoing", status: "read", phones: [p.phone_number_id] }),
          count({ direction: "outgoing", status: "failed", phones: [p.phone_number_id] }),
        ]);
        return { ...p, sent: s, delivered: d, read: r, failed: f, successRate: s > 0 ? Math.round(((d + r) / s) * 100) : 0 };
      }));

      const daily = await Promise.all(Array.from({ length: 7 }, (_, k) => 6 - k).map(async (i) => {
        const start = new Date(today); start.setDate(start.getDate() - i);
        const end = new Date(start); end.setDate(end.getDate() + 1);
        const range = { from: start.toISOString(), to: end.toISOString() };
        const [d, r, f] = await Promise.all([
          count({ direction: "outgoing", status: "delivered", ...range }),
          count({ direction: "outgoing", status: "read", ...range }),
          count({ direction: "outgoing", status: "failed", ...range }),
        ]);
        return { date: start.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }), entregues: d + r, falhas: f };
      }));

      return { apiName: api.name, since: api.created_at, total, delivered, read, failed, incoming, templatesToday, phones: phoneStats, daily };
    },
  });

  const data = query.data || EMPTY;
  const deliveryRate = data.total > 0 ? Math.round(((data.delivered + data.read) / data.total) * 100) : 0;
  const failureRate = data.total > 0 ? Math.round((data.failed / data.total) * 100) : 0;
  const responseRate = data.total > 0 ? Math.round((data.incoming / data.total) * 100) : 0;

  return { data, deliveryRate, failureRate, responseRate, isLoading: query.isLoading };
}
