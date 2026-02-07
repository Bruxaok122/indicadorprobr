import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface WabaPhoneNumber {
  id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string | null;
  quality_rating: string | null;
  is_active: boolean;
}

export function useWabaPhones() {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuthContext();

  // Fetch phone numbers available to the current user
  const { data: phones = [], isLoading } = useQuery({
    queryKey: ["waba-phones", user?.id, isAdmin],
    queryFn: async () => {
      if (!user?.id) return [];

      if (isAdmin) {
        // Admin sees all active phones
        const { data, error } = await supabase
          .from("waba_phone_numbers")
          .select("*")
          .eq("is_active", true)
          .order("display_phone_number");

        if (error) throw error;
        return data as WabaPhoneNumber[];
      }

      // Regular user: get permitted phones via permissions join
      const { data: permissions, error } = await supabase
        .from("user_phone_permissions")
        .select("phone_number_id")
        .eq("user_id", user.id);

      if (error) throw error;
      if (!permissions || permissions.length === 0) return [];

      const phoneIds = permissions.map((p) => p.phone_number_id);
      const { data: phonesData, error: phonesError } = await supabase
        .from("waba_phone_numbers")
        .select("*")
        .in("id", phoneIds)
        .eq("is_active", true)
        .order("display_phone_number");

      if (phonesError) throw phonesError;
      return phonesData as WabaPhoneNumber[];
    },
    enabled: !!user?.id,
  });

  // Sync phones from Meta (admin only)
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-waba-phones");
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.total} número(s) sincronizado(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["waba-phones"] });
      queryClient.invalidateQueries({ queryKey: ["waba-phones-all"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao sincronizar números", { description: error.message });
    },
  });

  // All phones for admin management
  const { data: allPhones = [] } = useQuery({
    queryKey: ["waba-phones-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waba_phone_numbers")
        .select("*")
        .order("display_phone_number");

      if (error) throw error;
      return data as WabaPhoneNumber[];
    },
    enabled: isAdmin,
  });

  // Get permissions for a specific user (admin)
  const getUserPermissions = async (userId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from("user_phone_permissions")
      .select("phone_number_id")
      .eq("user_id", userId);

    if (error) throw error;
    return (data || []).map((p) => p.phone_number_id);
  };

  // Update permissions for a user (admin)
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({
      userId,
      phoneNumberIds,
    }: {
      userId: string;
      phoneNumberIds: string[];
    }) => {
      // Delete all existing permissions for this user
      await supabase
        .from("user_phone_permissions")
        .delete()
        .eq("user_id", userId);

      // Insert new permissions
      if (phoneNumberIds.length > 0) {
        const rows = phoneNumberIds.map((phoneId) => ({
          user_id: userId,
          phone_number_id: phoneId,
        }));
        const { error } = await supabase
          .from("user_phone_permissions")
          .insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Permissões de números atualizadas!");
      queryClient.invalidateQueries({ queryKey: ["waba-phones"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar permissões", { description: error.message });
    },
  });

  return {
    phones,
    allPhones,
    isLoading,
    syncPhones: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    getUserPermissions,
    updatePermissions: updatePermissionsMutation.mutate,
    isUpdatingPermissions: updatePermissionsMutation.isPending,
  };
}
