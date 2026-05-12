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

      // Admin sees all messages for a contact (no user_id filter)
      if (isAdmin) {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("contact_id", contactId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return data as Message[];
      }

      // Operators see only their own messages + system messages
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
    refetchInterval: 8000,
    refetchIntervalInBackground: false,
  });

  // Check conversation window to enforce 24h rule
  const { data: activeConversation } = useQuery({
    queryKey: ["conversation-window", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data } = await supabase
        .from("conversations")
        .select("window_expires_at")
        .eq("contact_id", contactId)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!contactId,
    refetchInterval: 8000,
  });

  const hasMessages = messages.length > 0;
  const hasIncomingMessages = messages.some(m => m.direction === "incoming");
  const isWindowOpen = activeConversation?.window_expires_at
    ? new Date(activeConversation.window_expires_at) > new Date()
    : false;
  // Free text allowed only if client has replied AND 24h window is still open
  const canSendFreeText = hasIncomingMessages && isWindowOpen;

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
        (payload) => {
          // Use exact query key to avoid double invalidation
          queryClient.invalidateQueries({ queryKey: ["messages", contactId, user?.id], exact: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId, queryClient, user?.id]);

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

      if (error) {
        // Try to extract actual error message from the response
        try {
          const errorBody = await (error as any).context?.json?.();
          if (errorBody?.error) throw new Error(errorBody.error);
        } catch (e) {
          if (e instanceof Error && e.message !== error.message) throw e;
        }
        throw error;
      }
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", contactId, user?.id], exact: true });
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
      queryClient.invalidateQueries({ queryKey: ["messages", contactId, user?.id], exact: true });
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

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("messages")
        .update({ is_deleted: true, content: "Mensagem apagada" })
        .eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", contactId, user?.id], exact: true });
    },
    onError: (error: any) => {
      toast.error("Erro ao apagar mensagem", { description: error.message });
    },
  });

  const sendReactionMutation = useMutation({
    mutationFn: async (params: { messageId: string; emoji: string }) => {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-reaction", {
        body: { messageId: params.messageId, emoji: params.emoji, userId: user?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onMutate: async (params) => {
      const queryKey = ["messages", contactId, user?.id];
      await queryClient.cancelQueries({ queryKey, exact: true });
      const previous = queryClient.getQueryData<Message[]>(queryKey);
      const parent = previous?.find((m) => m.id === params.messageId);
      if (previous && parent) {
        const optimistic: Message = {
          ...parent,
          id: `optimistic-reaction-${params.messageId}-${Date.now()}`,
          message_type: "reaction",
          content: params.emoji,
          direction: "outgoing",
          reacts_to_message_id: params.messageId,
          created_at: new Date().toISOString(),
          status: "sent",
          user_id: user?.id ?? null,
        } as Message;
        // Replace any prior optimistic outgoing reaction from this user on this message
        const filtered = previous.filter(
          (m) => !(m.message_type === "reaction" && m.reacts_to_message_id === params.messageId && m.direction === "outgoing" && (m as any).user_id === user?.id && String(m.id).startsWith("optimistic-reaction-"))
        );
        queryClient.setQueryData<Message[]>(queryKey, [...filtered, optimistic]);
      }
      return { previous };
    },
    onError: (error: any, _params, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(["messages", contactId, user?.id], ctx.previous);
      toast.error("Erro ao reagir", { description: error.message });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", contactId, user?.id], exact: true });
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
    deleteMessage: deleteMessageMutation.mutate,
    sendReaction: sendReactionMutation.mutate,
  };
}
