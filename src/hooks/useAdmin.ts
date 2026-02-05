import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Profile } from "@/types/juriszap";
import { toast } from "sonner";

interface CreateUserParams {
  email: string;
  password: string;
  fullName: string;
  canUseSharedApi: boolean;
}

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalMessages: number;
  totalContacts: number;
}

export function useAdmin() {
  const queryClient = useQueryClient();

  // Fetch all users with profiles
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch admin stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [profilesRes, messagesRes, contactsRes] = await Promise.all([
        supabase.from("profiles").select("id, is_blocked", { count: "exact" }),
        supabase.from("messages").select("id", { count: "exact" }),
        supabase.from("contacts").select("id", { count: "exact" }),
      ]);

      const profiles = profilesRes.data || [];
      const blockedCount = profiles.filter((p: any) => p.is_blocked).length;

      return {
        totalUsers: profilesRes.count || 0,
        activeUsers: (profilesRes.count || 0) - blockedCount,
        blockedUsers: blockedCount,
        totalMessages: messagesRes.count || 0,
        totalContacts: contactsRes.count || 0,
      } as AdminStats;
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (params: CreateUserParams) => {
      // Call edge function to create user
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao criar usuário", {
        description: error.message,
      });
    },
  });

  // Toggle block mutation
  const toggleBlockMutation = useMutation({
    mutationFn: async ({ userId, isBlocked }: { userId: string; isBlocked: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_blocked: isBlocked })
        .eq("user_id", userId);

      if (error) throw error;

      // If blocking, deactivate all device sessions
      if (isBlocked) {
        await supabase
          .from("device_sessions")
          .update({ is_active: false })
          .eq("user_id", userId);
      }
    },
    onSuccess: (_, { isBlocked }) => {
      toast.success(isBlocked ? "Usuário bloqueado!" : "Usuário desbloqueado!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao alterar status", {
        description: error.message,
      });
    },
  });

  // Toggle API permission mutation
  const toggleApiPermissionMutation = useMutation({
    mutationFn: async ({ userId, canUseSharedApi }: { userId: string; canUseSharedApi: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ can_use_shared_api: canUseSharedApi })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, { canUseSharedApi }) => {
      toast.success(
        canUseSharedApi 
          ? "Permissão de API concedida!" 
          : "Permissão de API removida!"
      );
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao alterar permissão", {
        description: error.message,
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Usuário removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao remover usuário", {
        description: error.message,
      });
    },
  });

  return {
    users,
    isLoadingUsers,
    stats,
    isLoadingStats,
    createUser: createUserMutation.mutate,
    isCreatingUser: createUserMutation.isPending,
    toggleBlock: toggleBlockMutation.mutate,
    isTogglingBlock: toggleBlockMutation.isPending,
    toggleApiPermission: toggleApiPermissionMutation.mutate,
    isTogglingApiPermission: toggleApiPermissionMutation.isPending,
    deleteUser: deleteUserMutation.mutate,
    isDeletingUser: deleteUserMutation.isPending,
  };
}