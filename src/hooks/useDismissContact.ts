import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

/**
 * Hook para "dispensar" um contato compartilhado.
 * - Insere registro em contact_dismissals (uniq por contact_id+user_id).
 * - O trigger no banco bloqueia (status='encerrado') o contato se TODOS os
 *   operadores elegíveis dispensarem.
 * - Retorna também a lista de IDs de contatos dispensados pelo usuário atual,
 *   usada para esconder os cards localmente.
 */
export function useDismissedContacts() {
  const { user } = useAuthContext();
  const { data: dismissedIds = [] } = useQuery({
    queryKey: ["contact-dismissals", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data, error } = await supabase
        .from("contact_dismissals" as any)
        .select("contact_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((d: any) => d.contact_id as string);
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });
  return new Set(dismissedIds);
}

export function useDismissContact() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  const mutation = useMutation({
    mutationFn: async (contactId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { error } = await supabase
        .from("contact_dismissals" as any)
        .insert({ contact_id: contactId, user_id: user.id });
      if (error && !String(error.message).toLowerCase().includes("duplicate")) {
        throw error;
      }
      return contactId;
    },
    onSuccess: () => {
      toast.success("Conversa dispensada");
      queryClient.invalidateQueries({ queryKey: ["contact-dismissals"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao dispensar", { description: err.message });
    },
  });

  return {
    dismissContact: mutation.mutate,
    isDismissing: mutation.isPending,
  };
}
