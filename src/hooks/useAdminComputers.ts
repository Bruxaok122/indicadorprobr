import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { checkAdminComputer } from "@/lib/adminComputerAccess";

const deviceSchema = z.object({
  id: z.string(), registered: z.boolean(), is_blocked: z.boolean(),
  device_info: z.record(z.unknown()),
  last_seen_at: z.string().nullable().optional(),
  profile: z.object({ full_name: z.string().nullable(), email: z.string().nullable() }),
  sessions: z.array(z.object({ id: z.string(), last_seen_at: z.string() })),
});

export type AdminComputer = z.infer<typeof deviceSchema>;

export function useAdminComputers() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-computers"], staleTime: 1000, refetchInterval: 3000, refetchIntervalInBackground: true,
    queryFn: async () => {
      const access = await checkAdminComputer();
      if (!access.allowed) throw new Error("Acesso encerrado");
      const { data, error } = await supabase.rpc("list_admin_devices");
      if (error) throw error;
      return z.array(deviceSchema).parse(data);
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