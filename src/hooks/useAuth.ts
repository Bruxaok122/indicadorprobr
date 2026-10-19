import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Profile, UserRole } from "@/types/juriszap";
import { generateDeviceFingerprint, getDeviceInfo } from "@/lib/deviceFingerprint";
import { toast } from "sonner";

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: 'admin' | 'user' | null;
  isLoading: boolean;
  /** true depois que perfil/papel foram lidos do banco nesta sessão */
  profileLoaded: boolean;
  isBlocked: boolean;
  isTempBanned: boolean;
  banReason: string | null;
  banUntil: Date | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    role: null,
    isLoading: true,
    profileLoaded: false,
    isBlocked: false,
    isTempBanned: false,
    banReason: null,
    banUntil: null,
  });

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      // Fetch role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId);

      const userRole = roles?.find((r: UserRole) => r.role === 'admin') 
        ? 'admin' 
        : (roles?.length ? 'user' : null);

      const isBlocked = profile?.is_blocked || false;
      const isTempBanned = profile?.temp_banned_until ? new Date(profile.temp_banned_until) > new Date() : false;
      const banReason = profile?.ban_reason || null;
      const banUntil = profile?.temp_banned_until ? new Date(profile.temp_banned_until) : null;

      setState(prev => ({
        ...prev,
        profile: profile as Profile,
        role: userRole,
        isBlocked,
        isTempBanned,
        banReason,
        banUntil,
        isLoading: false,
        profileLoaded: true,
      }));

      return { profile, isBlocked, isTempBanned, banReason, banUntil };
    } catch (error) {
      console.error("Error fetching user data:", error);
      setState(prev => ({ ...prev, isLoading: false, profileLoaded: true }));
      return { profile: null, isBlocked: false, isTempBanned: false, banReason: null, banUntil: null };
    }
  }, []);

  const validateDevice = useCallback(async (userId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user || session.user.id !== userId) return false;

      const fingerprint = await generateDeviceFingerprint();
      const deviceInfo = getDeviceInfo();

      // Always update the current device info on profile
      await supabase
        .from("profiles")
        .update({
          device_fingerprint: fingerprint,
          last_device_info: deviceInfo,
          last_login_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      // Log the login attempt
      await supabase
        .from("login_attempts")
        .insert({
          user_id: userId,
          device_fingerprint: fingerprint,
          success: true,
        })
        .then(({ error }) => {
          if (error) console.warn("login_attempts insert failed:", error);
        });

      // Fetch the authorized fingerprint
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("authorized_fingerprint")
        .eq("user_id", userId)
        .single();

      if (profileError) throw profileError;

      // Check user role - admins bypass device authorization
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const isAdmin = roles?.some((r: any) => r.role === "admin");
      if (isAdmin) {
        // Admins always allowed - register device session
        await registerDeviceSession(userId, fingerprint, deviceInfo);
        return true;
      }

      // No authorized device yet → pending approval
      if (!profile?.authorized_fingerprint) {
        toast.info("Aguardando autorização", {
          description:
            "Seu dispositivo foi registrado. Aguarde o administrador autorizar o acesso.",
          duration: 10000,
        });
        await supabase.auth.signOut();
        return false;
      }

      // Device matches authorized → allow
      if (profile.authorized_fingerprint === fingerprint) {
        await registerDeviceSession(userId, fingerprint, deviceInfo);
        return true;
      }

      // Device does NOT match authorized → deny
      toast.error("Dispositivo não autorizado", {
        description:
          "Você só pode acessar pelo dispositivo autorizado pelo administrador. Entre em contato com o administrador.",
        duration: 10000,
      });
      await supabase.auth.signOut();
      return false;
    } catch (error) {
      console.error("Error validating device:", error);
      toast.error("Falha ao validar dispositivo", {
        description:
          "Não foi possível validar a sessão deste dispositivo. Por segurança, faça login novamente.",
        duration: 8000,
      });
      await supabase.auth.signOut();
      return false;
    }
  }, []);

  const registerDeviceSession = useCallback(
    async (userId: string, fingerprint: string, deviceInfo: any) => {
      // Deactivate other sessions
      await supabase
        .from("device_sessions")
        .update({ is_active: false })
        .eq("user_id", userId);

      // Upsert this device session
      await supabase
        .from("device_sessions")
        .upsert(
          {
            user_id: userId,
            device_fingerprint: fingerprint,
            device_info: deviceInfo,
            is_active: true,
          },
          { onConflict: "user_id,device_fingerprint" }
        );
    },
    []
  );

  useEffect(() => {
    let isMounted = true;
    let initialDone = false;

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        session,
      }));

      // Skip duplicate processing during initial load — getSession handles it
      if (!initialDone) return;

      if (session?.user) {
        setTimeout(async () => {
          if (!isMounted) return;
          const { isBlocked, isTempBanned, banReason, banUntil } =
            await fetchUserData(session.user.id);

          if (isTempBanned && banUntil) {
            const hoursLeft = Math.ceil(
              (banUntil.getTime() - Date.now()) / (1000 * 60 * 60)
            );
            toast.error("Conta temporariamente bloqueada", {
              description: `${banReason || "Atividade suspeita detectada"}. Tempo restante: ${hoursLeft} hora(s).`,
              duration: 10000,
            });
            await supabase.auth.signOut();
            return;
          }

          const profileData = await supabase
            .from("profiles")
            .select("subscription_plan, subscription_expires_at")
            .eq("user_id", session.user.id)
            .single();
          
          if (profileData.data?.subscription_plan && 
              profileData.data?.subscription_expires_at &&
              new Date(profileData.data.subscription_expires_at) < new Date()) {
            await supabase
              .from("profiles")
              .update({ is_blocked: true })
              .eq("user_id", session.user.id);
            
            toast.error("Plano expirado", {
              description: "Seu plano expirou. Entre em contato com o administrador para renovar.",
              duration: 10000,
            });
            await supabase.auth.signOut();
            return;
          }

          if (isBlocked) {
            toast.error("Conta bloqueada", {
              description: "Entre em contato com o administrador.",
            });
            await supabase.auth.signOut();
            return;
          }

          if (event === "SIGNED_IN") {
            await validateDevice(session.user.id);
          }
        }, 0);
      } else {
        setState((prev) => ({
          ...prev,
          profile: null,
          role: null,
          isBlocked: false,
          isTempBanned: false,
          banReason: null,
          banUntil: null,
          isLoading: false,
          profileLoaded: false,
        }));
      }
    });

    // THEN get initial session (single source of truth for first load)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setState((prev) => ({
          ...prev,
          user: session?.user ?? null,
          session,
        }));

        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch {
        if (isMounted) setState((prev) => ({ ...prev, isLoading: false }));
      } finally {
        initialDone = true;
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData, validateDevice]);

  // Guard: if this device becomes inactive or unauthorized, force logout.
  useEffect(() => {
    const userId = state.user?.id;
    if (!userId || !state.session) return;

    let isCancelled = false;
    let intervalId: number | undefined;

    (async () => {
      const fingerprint = await generateDeviceFingerprint();
      const deviceInfo = getDeviceInfo();
      if (isCancelled) return;

      const tick = async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.user || session.user.id !== userId) return;

          // Check if device is still authorized
          const { data: profile } = await supabase
            .from("profiles")
            .select("authorized_fingerprint, is_blocked")
            .eq("user_id", userId)
            .single();

          // Check if blocked
          if (profile?.is_blocked) {
            toast.error("Conta bloqueada", {
              description: "Entre em contato com o administrador.",
            });
            await supabase.auth.signOut();
            return;
          }

          // Check user role - admins bypass device check
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);

          const isAdmin = roles?.some((r: any) => r.role === "admin");

          // If not admin and authorized fingerprint changed (admin reset or changed), force logout
          if (!isAdmin && profile?.authorized_fingerprint && profile.authorized_fingerprint !== fingerprint) {
            toast.error("Dispositivo desautorizado", {
              description: "O administrador alterou o dispositivo autorizado. Faça login novamente.",
              duration: 10000,
            });
            await supabase.auth.signOut();
            return;
          }

          // Keep device session active
          const { data: current } = await supabase
            .from("device_sessions")
            .select("id")
            .eq("user_id", userId)
            .eq("device_fingerprint", fingerprint)
            .eq("is_active", true)
            .maybeSingle();

          if (current?.id) {
            await supabase
              .from("device_sessions")
              .update({ last_seen_at: new Date().toISOString() })
              .eq("id", current.id);
          } else if (isAdmin) {
            // Re-register for admins
            await registerDeviceSession(userId, fingerprint, deviceInfo);
          }
        } catch (err) {
          console.error("Device session guard error:", err);
        }
      };

      await tick();
      intervalId = window.setInterval(tick, 8000);
    })();

    return () => {
      isCancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [state.user?.id, state.session, registerDeviceSession]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // After successful auth, check temp ban status
    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("temp_banned_until, ban_reason")
        .eq("user_id", data.user.id)
        .single();

      if (profileError) throw profileError;

      if (
        profile?.temp_banned_until &&
        new Date(profile.temp_banned_until) > new Date()
      ) {
        const banUntil = new Date(profile.temp_banned_until);
        const hoursLeft = Math.ceil(
          (banUntil.getTime() - Date.now()) / (1000 * 60 * 60)
        );
        await supabase.auth.signOut();
        throw new Error(
          `Conta temporariamente bloqueada. ${profile.ban_reason || "Atividade suspeita detectada"}. Tempo restante: ${hoursLeft} hora(s).`
        );
      }

      // Device enforcement is handled by the auth listener (SIGNED_IN) to avoid race conditions.
    }

    return data;
  };

  const signOut = async () => {
    try {
      // Deactivate device session
      if (state.user) {
        const fingerprint = await generateDeviceFingerprint();
        await supabase
          .from("device_sessions")
          .update({ is_active: false })
          .eq("user_id", state.user.id)
          .eq("device_fingerprint", fingerprint);
      }
    } catch (error) {
      console.error("Error deactivating device session:", error);
    }

    await supabase.auth.signOut();
  };

  return {
    ...state,
    signIn,
    signOut,
    isAdmin: state.role === 'admin',
    isAuthenticated: !!state.session,
  };
}