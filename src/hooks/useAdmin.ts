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

  // Fetch all users with profiles and their latest session
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch active sessions for all users
      const { data: sessions } = await supabase
        .from("device_sessions")
        .select("*")
        .eq("is_active", true)
        .order("last_seen_at", { ascending: false });

      // Merge session data into profiles
      const usersWithSessions = (profiles || []).map(profile => {
        const userSession = sessions?.find(s => s.user_id === profile.user_id);
        return {
          ...profile,
          active_session: userSession || null,
        };
      });

      return usersWithSessions as (Profile & { active_session: any })[];
    },
  });

  // Fetch admin stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [profilesRes, messagesRes, contactsRes] = await Promise.all([
        supabase.from("profiles").select("id, is_blocked", { count: "exact" }),
        supabase.from("messages").select("id", { count: "exact" }).eq("direction", "outgoing"),
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

  // Toggle manage numbers permission mutation
  const toggleManageNumbersMutation = useMutation({
    mutationFn: async ({ userId, canManageNumbers }: { userId: string; canManageNumbers: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ can_manage_numbers: canManageNumbers } as any)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, { canManageNumbers }) => {
      toast.success(
        canManageNumbers 
          ? "Permissão de gerenciar números concedida!" 
          : "Permissão de gerenciar números removida!"
      );
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao alterar permissão", {
        description: error.message,
      });
    },
  });

  // Toggle dispatch permission mutation
  const toggleDispatchMutation = useMutation({
    mutationFn: async ({ userId, canDispatch }: { userId: string; canDispatch: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ can_dispatch: canDispatch } as any)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { canDispatch }) => {
      toast.success(canDispatch ? "Permissão de disparos concedida!" : "Permissão de disparos removida!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao alterar permissão", { description: error.message });
    },
  });

  // Toggle "replay admin dispatch" permission
  const toggleReplayPermissionMutation = useMutation({
    mutationFn: async ({ userId, canReplay }: { userId: string; canReplay: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ can_replay_admin_dispatch: canReplay } as any)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { canReplay }) => {
      toast.success(canReplay ? "Permissão para repetir disparo admin concedida!" : "Permissão removida!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao alterar permissão", { description: error.message });
    },
  });


  const clearTempBanMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          temp_banned_until: null,
          ban_reason: null,
          failed_device_attempts: 0,
          last_failed_attempt_at: null,
        })
        .eq("user_id", userId);

      if (error) throw error;
      
      // Also clear all failed attempts via RPC
      await supabase.rpc("clear_failed_attempts", { _user_id: userId });
      
      // Deactivate all device sessions to allow fresh login
      await supabase
        .from("device_sessions")
        .update({ is_active: false })
        .eq("user_id", userId);
    },
    onSuccess: () => {
      toast.success("Bloqueio temporário removido! Sessões de dispositivo foram resetadas.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao remover bloqueio", {
        description: error.message,
      });
    },
  });

  // Set subscription plan mutation
  const setSubscriptionPlanMutation = useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string | null }) => {
      const { error } = await supabase.rpc("set_subscription_plan", {
        _user_id: userId,
        _plan: plan || "",
      });
      if (error) throw error;
    },
    onSuccess: (_, { plan }) => {
      toast.success(
        plan 
          ? `Plano ${plan} ativado com sucesso!` 
          : "Plano removido!"
      );
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao alterar plano", {
        description: error.message,
      });
    },
  });

  // Authorize device mutation
  const authorizeDeviceMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Get user's current device fingerprint and info
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("device_fingerprint, last_device_info")
        .eq("user_id", userId)
        .single();

      if (fetchError) throw fetchError;
      if (!profile?.device_fingerprint) {
        throw new Error("Usuário ainda não fez login em nenhum dispositivo.");
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          authorized_fingerprint: profile.device_fingerprint,
          authorized_device_info: profile.last_device_info,
        })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dispositivo autorizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao autorizar dispositivo", {
        description: error.message,
      });
    },
  });

  // Reset authorized device mutation
  const resetDeviceMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          authorized_fingerprint: null,
          authorized_device_info: null,
        })
        .eq("user_id", userId);

      if (error) throw error;

      // Also deactivate sessions
      await supabase
        .from("device_sessions")
        .update({ is_active: false })
        .eq("user_id", userId);
    },
    onSuccess: () => {
      toast.success("Dispositivo desautorizado! Usuário precisará de nova autorização.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao resetar dispositivo", {
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

  const refreshAll = async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["admin-users"] }),
      queryClient.refetchQueries({ queryKey: ["admin-stats"] }),
    ]);
    toast.success("Dados atualizados!");
  };

  return {
    users,
    isLoadingUsers,
    stats,
    isLoadingStats,
    refreshAll,
    createUser: createUserMutation.mutate,
    isCreatingUser: createUserMutation.isPending,
    toggleBlock: toggleBlockMutation.mutate,
    isTogglingBlock: toggleBlockMutation.isPending,
    toggleApiPermission: toggleApiPermissionMutation.mutate,
    isTogglingApiPermission: toggleApiPermissionMutation.isPending,
    toggleManageNumbers: toggleManageNumbersMutation.mutate,
    isTogglingManageNumbers: toggleManageNumbersMutation.isPending,
    toggleDispatch: toggleDispatchMutation.mutate,
    isTogglingDispatch: toggleDispatchMutation.isPending,
    deleteUser: deleteUserMutation.mutate,
    isDeletingUser: deleteUserMutation.isPending,
    clearTempBan: clearTempBanMutation.mutate,
    isClearingTempBan: clearTempBanMutation.isPending,
    setSubscriptionPlan: setSubscriptionPlanMutation.mutate,
    isSettingPlan: setSubscriptionPlanMutation.isPending,
    authorizeDevice: authorizeDeviceMutation.mutate,
    isAuthorizingDevice: authorizeDeviceMutation.isPending,
    resetDevice: resetDeviceMutation.mutate,
    isResettingDevice: resetDeviceMutation.isPending,
  };
}