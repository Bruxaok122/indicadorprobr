import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Contact, ParsedContact } from "@/types/juriszap";
import { toast } from "sonner";
import { useEffect, useCallback } from "react";
import { useAuthContext } from "@/contexts/AuthContext";

export function useContacts() {
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuthContext();

  const { data: contacts = [], isLoading, refetch: refetchContacts } = useQuery({
    queryKey: ["contacts", isAdmin, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Admin sees orphan contacts (pool) + contacts assigned to themselves (takeover)
      if (isAdmin) {
        const { data, error } = await supabase
          .from("contacts")
          .select("*")
          .or(`user_id.is.null,user_id.eq.${user.id}`)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data as Contact[];
      }

      // Regular users see: own contacts + shared dispatched contacts not yet claimed by someone else
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .or(`user_id.eq.${user.id},and(dispatch_mode.eq.shared,or(claimed_by.is.null,claimed_by.eq.${user.id}))`)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!user?.id,
    // Auto-refresh every 10 seconds to ensure operator always sees latest contacts
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("contacts-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["contacts"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const addContactMutation = useMutation({
    mutationFn: async (contact: Omit<ParsedContact, 'phone'> & { phone: string }) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          name: contact.name,
          phone: contact.phone,
          lawyer_name: contact.lawyer_name,
          process_number: contact.process_number,
          status: "novo",
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Contato adicionado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao adicionar contato", {
        description: error.message,
      });
    },
  });

  const importContactsMutation = useMutation({
    mutationFn: async (contacts: ParsedContact[]) => {
      if (!user) throw new Error("Usuário não autenticado");

      const results = { successful: 0, failed: 0 };

      for (const contact of contacts) {
        const { error } = await supabase.from("contacts").insert({
          name: contact.name,
          phone: contact.phone,
          lawyer_name: contact.lawyer_name,
          process_number: contact.process_number,
          status: "novo",
          user_id: user.id,
        });

        if (error) {
          results.failed++;
          console.error("Error importing contact:", error);
        } else {
          results.successful++;
        }
      }

      // Log import
      await supabase.from("import_logs").insert({
        total_contacts: contacts.length,
        successful: results.successful,
        failed: results.failed,
        user_id: user.id,
      });

      return results;
    },
    onSuccess: (results) => {
      toast.success(`Importação concluída!`, {
        description: `${results.successful} contatos importados, ${results.failed} falhas`,
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: any) => {
      toast.error("Erro na importação", {
        description: error.message,
      });
    },
  });

  const deleteContactsMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .in("id", contactIds);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contatos removidos com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao remover contatos", {
        description: error.message,
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao remover contato", {
        description: error.message,
      });
    },
  });

  const toggleContactBlockMutation = useMutation({
    mutationFn: async ({ contactId, blocked }: { contactId: string; blocked: boolean }) => {
      const newStatus = blocked ? "encerrado" : "novo";
      const { error } = await supabase
        .from("contacts")
        .update({ status: newStatus })
        .eq("id", contactId);

      if (error) throw error;
      return { blocked };
    },
    onSuccess: (result) => {
      toast.success(result.blocked ? "Cliente bloqueado" : "Cliente desbloqueado");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao alterar status do cliente", {
        description: error.message,
      });
    },
  });

  const togglePriorityMutation = useMutation({
    mutationFn: async ({ contactId, isPriority }: { contactId: string; isPriority: boolean }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ is_priority: isPriority } as any)
        .eq("id", contactId);
      if (error) throw error;
      return { isPriority };
    },
    onSuccess: (result) => {
      toast.success(result.isPriority ? "Prioridade ativada ⭐" : "Prioridade removida");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao alterar prioridade", { description: error.message });
    },
  });

  const clearAllContactsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");

      // Admin sees own + orphan contacts, so fetch all visible contacts
      let query = supabase.from("contacts").select("id");
      if (isAdmin) {
        query = query.is("user_id", null);
      } else {
        query = query.eq("user_id", user.id);
      }
      const { data: userContacts } = await query;

      if (!userContacts || userContacts.length === 0) return;

      // Delete in batches of 100 to avoid URL length limits
      const batchSize = 100;
      for (let i = 0; i < userContacts.length; i += batchSize) {
        const batch = userContacts.slice(i, i + batchSize).map(c => c.id);
        await supabase.from("messages").delete().in("contact_id", batch);
        await supabase.from("conversations").delete().in("contact_id", batch);
        await supabase.from("contacts").delete().in("id", batch);
      }
    },
    onSuccess: () => {
      toast.success("Lista limpa com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao limpar lista", { description: error.message });
    },
  });

  return {
    contacts,
    isLoading,
    addContact: addContactMutation.mutate,
    isAddingContact: addContactMutation.isPending,
    importContacts: importContactsMutation.mutate,
    isImporting: importContactsMutation.isPending,
    deleteContact: deleteContactMutation.mutate,
    isDeleting: deleteContactMutation.isPending,
    deleteContacts: deleteContactsMutation.mutate,
    isDeletingContacts: deleteContactsMutation.isPending,
    toggleContactBlock: toggleContactBlockMutation.mutate,
    isTogglingBlock: toggleContactBlockMutation.isPending,
    togglePriority: togglePriorityMutation.mutate,
    isTogglingPriority: togglePriorityMutation.isPending,
    clearAllContacts: clearAllContactsMutation.mutate,
    isClearingAll: clearAllContactsMutation.isPending,
    refetchContacts,
  };
}
