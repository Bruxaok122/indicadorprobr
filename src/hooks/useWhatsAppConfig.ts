import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppConfig } from "@/types/juriszap";
import { toast } from "sonner";

export function useWhatsAppConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as WhatsAppConfig | null;
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (params: { accessToken: string; wabaId: string; phoneNumberId: string }) => {
      const { data, error } = await supabase.functions.invoke("validate-whatsapp", {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.valid) {
        toast.success("Conexão validada com sucesso!", {
          description: data.phoneNumber ? `Número: ${data.phoneNumber}` : undefined,
        });
        queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
      } else {
        toast.error("Falha na validação", {
          description: data.error,
        });
      }
    },
    onError: (error: any) => {
      toast.error("Erro ao validar conexão", {
        description: error.message,
      });
    },
  });

  return {
    config,
    isLoading,
    isConfigured: config?.is_validated ?? false,
    validate: validateMutation.mutate,
    isValidating: validateMutation.isPending,
  };
}
