import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAdminComputers() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-computers"], staleTime: 2000, refetchInterval: 5000,
    queryFn: async () => {
      const [computers, sessions, profiles] = await Promise.all([
        supabase.from("admin_computers").select("*").order("updated_at", { ascending: false }),
        supabase.from("admin_login_sessions").select("*").eq("is_active", true),
        supabase.from("profiles").select("user_id, full_name, email"),
      ]);
      if (computers.error) throw computers.error;
      if (sessions.error) throw sessions.error;
      if (profiles.error) throw profiles.error;
      return computers.data.map(computer => ({ ...computer,
        profile: profiles.data.find(p => p.user_id === computer.user_id),
        sessions: sessions.data.filter(s => s.computer_id === computer.id),
      }));
    },
  });
  const action = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "logout" | "block" | "unblock" }) => {
      const { error } = await supabase.rpc("manage_admin_computer", { p_computer_id: id, p_action: action });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === "block" ? "Computador bloqueado" : variables.action === "unblock" ? "Computador desbloqueado" : "Acesso encerrado");
      void client.invalidateQueries({ queryKey: ["admin-computers"] });
    },
    onError: () => toast.error("Não foi possível alterar este acesso. Tente novamente."),
  });
  return { ...query, action };
}