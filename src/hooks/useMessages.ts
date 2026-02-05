import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types/juriszap";
import { toast } from "sonner";
import { useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";

export function useMessages(contactId: string | null) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthContext();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", contactId, isAdmin],
    queryFn: async () => {
      if (!contactId) return [];

      // Just fetch messages for the contact - RLS handles permissions
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!contactId && isAdmin !== undefined,
  });

  // Check if conversation has any messages (to enforce template-first rule)
  const hasMessages = messages.length > 0;
  const canSendFreeText = messages.some(m => m.direction === "incoming");

  // Realtime subscription
  useEffect(() => {
    if (!contactId) return;

    const channel = supabase
      .channel(`messages-${contactId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", contactId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: async (params: {
      contactId: string;
      message?: string;
      templateName?: string;
      isTemplate?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar mensagem", {
        description: error.message,
      });
    },
  });

  const sendDocumentMutation = useMutation({
    mutationFn: async (params: {
      contactId: string;
      documentUrl: string;
      documentName: string;
      caption?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-document", {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar documento", {
        description: error.message,
      });
    },
  });

  return {
    messages,
    isLoading,
    hasMessages,
    canSendFreeText,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    sendDocument: sendDocumentMutation.mutate,
    isSendingDocument: sendDocumentMutation.isPending,
  };
}
