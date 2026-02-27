import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

export interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components?: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: {
      body_text?: string[][];
    };
  }>;
}

export function useMetaTemplates() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["meta-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-meta-templates");

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data.templates as MetaTemplate[];
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const sendBulkMutation = useMutation({
    mutationFn: async (params: {
      contactIds: string[];
      templateName: string;
      templateLanguage?: string;
      selectedPhoneNumberId?: string;
      variableMappings?: Record<string, string>;
      targetUserId?: string;
    }) => {
      const { targetUserId, contactIds, ...rest } = params;
      const userId = user?.id;
      const BATCH_SIZE = 50;
      const totalResults = { total: contactIds.length, sent: 0, failed: 0, errors: [] as string[] };

      for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
        const batch = contactIds.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(contactIds.length / BATCH_SIZE);
        
        toast.info(`Enviando lote ${batchNum}/${totalBatches}...`, { id: "bulk-progress" });

        const { data, error } = await supabase.functions.invoke("send-bulk-template", {
          body: { ...rest, contactIds: batch, userId, targetUserId: targetUserId && targetUserId !== "__admin__" ? targetUserId : undefined },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        totalResults.sent += data.results?.sent || 0;
        totalResults.failed += data.results?.failed || 0;
        if (data.results?.errors) {
          totalResults.errors.push(...data.results.errors);
        }
      }

      return {
        success: true,
        results: totalResults,
        message: `Disparo concluído: ${totalResults.sent} enviados, ${totalResults.failed} falhas`,
      };
    },
    onSuccess: (data) => {
      toast.success(data.message, { id: "bulk-progress" });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (error: any) => {
      toast.error("Erro no disparo em massa", {
        description: error.message,
        id: "bulk-progress",
      });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      category: string;
      language?: string;
      bodyText: string;
      headerText?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("create-meta-template", {
        body: params,
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["meta-templates"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao criar template", { description: error.message });
    },
  });

  // Only return approved templates
  const approvedTemplates = (data || []).filter(t => t.status === "APPROVED");

  return {
    templates: approvedTemplates,
    allTemplates: data || [],
    isLoading,
    error,
    refetch,
    sendBulk: sendBulkMutation.mutate,
    isSendingBulk: sendBulkMutation.isPending,
    createTemplate: createTemplateMutation.mutate,
    isCreatingTemplate: createTemplateMutation.isPending,
  };
}
