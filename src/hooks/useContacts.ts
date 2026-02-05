import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Contact, ParsedContact } from "@/types/juriszap";
import { toast } from "sonner";
import { useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";

export function useContacts() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthContext();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", isAdmin],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Admins see all contacts, regular users see only their own
      let query = supabase
        .from("contacts")
        .select("*");
      
      if (!isAdmin) {
        query = query.eq("user_id", user.id);
      }
      
      const { data, error } = await query
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Contact[];
    },
    enabled: isAdmin !== undefined,
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
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
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
  };
}
