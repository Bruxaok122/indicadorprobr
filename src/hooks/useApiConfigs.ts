import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ApiConfig {
  id: string;
  name: string;
  access_token: string;
  waba_id: string;
  phone_number_id: string;
  is_active: boolean;
  is_validated: boolean;
  status_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useApiConfigs() {
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["api-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_configs" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as ApiConfig[];
    },
  });

  const activeConfig = configs.find((c) => c.is_active) || null;

  const addConfigMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      access_token: string;
      waba_id: string;
      phone_number_id: string;
      setActive?: boolean;
    }) => {
      // Validate with Meta API first
      const phoneUrl = `https://graph.facebook.com/v18.0/${params.phone_number_id}`;
      const phoneRes = await fetch(phoneUrl, {
        headers: { Authorization: `Bearer ${params.access_token}` },
      });

      let statusMessage = "";
      let isValidated = false;

      if (phoneRes.ok) {
        const phoneData = await phoneRes.json();
        statusMessage = `✅ Sistema conectado com sucesso nessa API — ${phoneData.display_phone_number || params.name}`;
        isValidated = true;
      } else {
        const errData = await phoneRes.json();
        statusMessage = `❌ Falha na conexão: ${errData.error?.message || "Erro desconhecido"}`;
      }

      const { data, error } = await supabase
        .from("api_configs" as any)
        .insert({
          name: params.name,
          access_token: params.access_token,
          waba_id: params.waba_id,
          phone_number_id: params.phone_number_id,
          is_active: params.setActive ?? false,
          is_validated: isValidated,
          status_message: statusMessage,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Also sync to whatsapp_config for backward compat if active
      if (params.setActive && isValidated) {
        await syncToWhatsAppConfig(params);
      }

      return data;
    },
    onSuccess: (_, params) => {
      toast.success(`API "${params.name}" adicionada com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["api-configs"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
      queryClient.invalidateQueries({ queryKey: ["waba-phones"] });
      queryClient.invalidateQueries({ queryKey: ["waba-phones-all"] });
      queryClient.invalidateQueries({ queryKey: ["meta-templates"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao adicionar API", { description: error.message });
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: async (configId: string) => {
      const config = configs.find((c) => c.id === configId);
      if (!config) throw new Error("Configuração não encontrada");

      // The trigger will deactivate others
      const { error } = await supabase
        .from("api_configs" as any)
        .update({ is_active: true } as any)
        .eq("id", configId);

      if (error) throw error;

      // Sync to whatsapp_config for backward compat
      await syncToWhatsAppConfig(config);
    },
    onSuccess: () => {
      toast.success("API ativa alterada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["api-configs"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
      queryClient.invalidateQueries({ queryKey: ["waba-phones"] });
      queryClient.invalidateQueries({ queryKey: ["waba-phones-all"] });
      queryClient.invalidateQueries({ queryKey: ["meta-templates"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao alterar API ativa", { description: error.message });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (configId: string) => {
      const { error } = await supabase
        .from("api_configs" as any)
        .delete()
        .eq("id", configId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("API removida!");
      queryClient.invalidateQueries({ queryKey: ["api-configs"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao remover API", { description: error.message });
    },
  });

  const revalidateMutation = useMutation({
    mutationFn: async (configId: string) => {
      const config = configs.find((c) => c.id === configId);
      if (!config) throw new Error("Configuração não encontrada");

      const phoneUrl = `https://graph.facebook.com/v18.0/${config.phone_number_id}`;
      const phoneRes = await fetch(phoneUrl, {
        headers: { Authorization: `Bearer ${config.access_token}` },
      });

      let statusMessage = "";
      let isValidated = false;

      if (phoneRes.ok) {
        const phoneData = await phoneRes.json();
        statusMessage = `✅ Sistema conectado com sucesso nessa API — ${phoneData.display_phone_number || config.name}`;
        isValidated = true;
      } else {
        const errData = await phoneRes.json();
        statusMessage = `❌ Falha na conexão: ${errData.error?.message || "Erro desconhecido"}`;
      }

      const { error } = await supabase
        .from("api_configs" as any)
        .update({ is_validated: isValidated, status_message: statusMessage } as any)
        .eq("id", configId);

      if (error) throw error;
      return { isValidated, statusMessage };
    },
    onSuccess: (result) => {
      if (result.isValidated) {
        toast.success("Conexão validada!");
      } else {
        toast.error("Falha na validação");
      }
      queryClient.invalidateQueries({ queryKey: ["api-configs"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao validar", { description: error.message });
    },
  });

  // Auto-revalidate invalidated APIs every 2 minutes
  const autoRevalidateRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autoRevalidateRef.current) clearInterval(autoRevalidateRef.current);

    const invalidConfigs = configs.filter((c) => !c.is_validated);
    if (invalidConfigs.length === 0) return;

    const checkInvalid = async () => {
      for (const config of invalidConfigs) {
        try {
          const phoneUrl = `https://graph.facebook.com/v18.0/${config.phone_number_id}`;
          const phoneRes = await fetch(phoneUrl, {
            headers: { Authorization: `Bearer ${config.access_token}` },
          });

          if (phoneRes.ok) {
            const phoneData = await phoneRes.json();
            const statusMessage = `✅ Sistema conectado com sucesso nessa API — ${phoneData.display_phone_number || config.name}`;

            await supabase
              .from("api_configs" as any)
              .update({ is_validated: true, status_message: statusMessage } as any)
              .eq("id", config.id);

            toast.success(`🎉 API "${config.name}" desbloqueada!`, {
              description: "A conexão foi restabelecida automaticamente.",
              duration: 10000,
            });

            queryClient.invalidateQueries({ queryKey: ["api-configs"] });
          }
        } catch {
          // Silently ignore - will retry next interval
        }
      }
    };

    // Check immediately once, then every 2 minutes
    checkInvalid();
    autoRevalidateRef.current = setInterval(checkInvalid, 2 * 60 * 1000);

    return () => {
      if (autoRevalidateRef.current) clearInterval(autoRevalidateRef.current);
    };
  }, [configs, queryClient]);

  return {
    configs,
    activeConfig,
    isLoading,
    addConfig: addConfigMutation.mutate,
    isAdding: addConfigMutation.isPending,
    setActive: setActiveMutation.mutate,
    isSettingActive: setActiveMutation.isPending,
    deleteConfig: deleteConfigMutation.mutate,
    isDeleting: deleteConfigMutation.isPending,
    revalidate: revalidateMutation.mutate,
    isRevalidating: revalidateMutation.isPending,
  };
}

async function syncToWhatsAppConfig(config: {
  access_token: string;
  waba_id: string;
  phone_number_id: string;
}) {
  // Delete old config and insert new one (backward compat with edge functions)
  await supabase
    .from("whatsapp_config")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  await supabase.from("whatsapp_config").insert({
    access_token: config.access_token,
    waba_id: config.waba_id,
    phone_number_id: config.phone_number_id,
    is_validated: true,
  });
}
