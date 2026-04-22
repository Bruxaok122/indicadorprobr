import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

/**
 * Hook para "assumir" (claim) um contato compartilhado.
 * Regra: só pode assumir se dispatch_mode = 'shared', ainda não foi claimed,
 * e o cliente já respondeu (status diferente de 'novo'/'aguardando' apenas — exigimos 'respondido' ou já houve mensagem incoming).
 *
 * Usa UPDATE atômico com filtro `claimed_by.is.null` para evitar race condition entre operadores.
 */
export function useClaimContact() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuthContext();

  const mutation = useMutation({
    mutationFn: async (contactId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      // Verifica se cliente já respondeu (deve haver pelo menos 1 mensagem incoming)
      const { count: incomingCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contactId)
        .eq("direction", "incoming");

      if (!incomingCount || incomingCount === 0) {
        throw new Error("Aguarde o cliente responder ao template antes de assumir.");
      }

      // Claim atômico: só atualiza se ainda não foi reivindicado
      const { data, error } = await supabase
        .from("contacts")
        .update({
          claimed_by: user.id,
          claimed_at: new Date().toISOString(),
          user_id: user.id,
        } as any)
        .eq("id", contactId)
        .eq("dispatch_mode" as any, "shared")
        .is("claimed_by" as any, null)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Outro operador já assumiu esta conversa.");

      // Reatribui também as mensagens existentes (incoming/system) ao novo dono para visibilidade
      // Nota: não tocamos em messages.user_id pois RLS já permite via can_view_contact
      return data;
    },
    onSuccess: () => {
      toast.success("Conversa assumida! Agora você pode responder.");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: any) => {
      toast.error("Não foi possível assumir", { description: err.message });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  return {
    claimContact: mutation.mutate,
    isClaiming: mutation.isPending,
  };
}
