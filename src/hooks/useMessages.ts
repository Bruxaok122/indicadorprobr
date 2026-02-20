import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types/juriszap";
import { toast } from "sonner";
import { useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";

export function useMessages(contactId: string | null) {
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuthContext();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", contactId, user?.id],
    queryFn: async () => {
      if (!contactId || !user?.id) return [];

      // All users (including admin) see only messages linked to their user_id
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("contact_id", contactId)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!contactId && !!user?.id,
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
      selectedPhoneNumberId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-message", {
        body: { ...params, userId: user?.id },
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
      if (error.message?.includes("já foi atendido")) {
        toast.info("Contato indisponível", {
          description: "Este contato já está sendo atendido por outro usuário.",
        });
      } else {
        toast.error("Erro ao enviar mensagem", {
          description: error.message,
        });
      }
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
        body: { ...params, userId: user?.id },
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

  const sendAudioMutation = useMutation({
    mutationFn: async (params: {
      contactId: string;
      audioBlob: Blob;
      selectedPhoneNumberId?: string;
    }) => {
      const formData = new FormData();
      const ext = params.audioBlob.type.includes("ogg") ? "ogg" : "webm";
      formData.append("audio", params.audioBlob, `audio.${ext}`);
      formData.append("contactId", params.contactId);
      if (user?.id) formData.append("userId", user.id);
      if (params.selectedPhoneNumberId) formData.append("selectedPhoneNumberId", params.selectedPhoneNumberId);

      const { data, error } = await supabase.functions.invoke("send-whatsapp-audio", {
        body: formData,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, params) => {
      // Force immediate refetch — don't rely on realtime latency
      queryClient.refetchQueries({
        queryKey: ["messages", params.contactId, user?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"], refetchType: "active" });
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar áudio", {
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
    sendAudio: sendAudioMutation.mutate,
    isSendingAudio: sendAudioMutation.isPending,
  };
}
