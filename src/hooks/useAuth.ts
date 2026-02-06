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
      }));

      return { profile, isBlocked, isTempBanned, banReason, banUntil };
    } catch (error) {
      console.error("Error fetching user data:", error);
      setState(prev => ({ ...prev, isLoading: false }));
      return { profile: null, isBlocked: false, isTempBanned: false, banReason: null, banUntil: null };
    }
  }, []);

  const validateDevice = useCallback(async (userId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // If there's no authenticated session (or it doesn't match), do nothing.
      if (!session?.user || session.user.id !== userId) return false;

      const fingerprint = await generateDeviceFingerprint();
      const deviceInfo = getDeviceInfo();

      // Check ALL active sessions for this user
      const { data: existingSessions, error: existingSessionsError } = await supabase
        .from("device_sessions")
        .select("id, device_fingerprint")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (existingSessionsError) throw existingSessionsError;

      // Check if this device is already registered
      const currentDevice = existingSessions?.find(
        (s) => s.device_fingerprint === fingerprint
      );

      if (currentDevice) {
        // Update last seen
        const { error: updateSeenError } = await supabase
          .from("device_sessions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", currentDevice.id);

        if (updateSeenError) throw updateSeenError;

        const { error: clearAttemptsError } = await supabase.rpc(
          "clear_failed_attempts",
          { _user_id: userId }
        );
        if (clearAttemptsError) throw clearAttemptsError;

        return true;
      }

      // If there are no active sessions (e.g., user was unblocked by admin),
      // allow login from any device without restriction
      if (!existingSessions || existingSessions.length === 0) {
        const { error: upsertSessionError } = await supabase
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

        if (upsertSessionError) throw upsertSessionError;

        // Audit log (não deve bloquear login se falhar)
        const { error: logAttemptError } = await supabase
          .from("login_attempts")
          .insert({
            user_id: userId,
            device_fingerprint: fingerprint,
            success: true,
          });
        if (logAttemptError) {
          console.warn("login_attempts insert failed:", logAttemptError);
        }

        const { error: updateProfileError } = await supabase
          .from("profiles")
          .update({
            device_fingerprint: fingerprint,
            last_device_info: deviceInfo,
            last_login_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (updateProfileError) throw updateProfileError;

        const { error: clearAttemptsError } = await supabase.rpc(
          "clear_failed_attempts",
          { _user_id: userId }
        );
        if (clearAttemptsError) throw clearAttemptsError;

        return true;
      }

      // If user has another active device, record failed attempt and deny access
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("failed_device_attempts")
        .eq("user_id", userId)
        .single();

      if (profileError) throw profileError;

      const currentAttempts = profile?.failed_device_attempts || 0;

      // First attempt: warn and allow device change (by deactivating old sessions)
      if (currentAttempts === 0) {
        const { error: deactivateError } = await supabase
          .from("device_sessions")
          .update({ is_active: false })
          .eq("user_id", userId);

        if (deactivateError) throw deactivateError;

        const { error: warningUpdateError } = await supabase
          .from("profiles")
          .update({
            failed_device_attempts: 1,
            last_failed_attempt_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (warningUpdateError) throw warningUpdateError;

        const { error: upsertSessionError } = await supabase
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

        if (upsertSessionError) throw upsertSessionError;

        // Audit log (não deve bloquear login se falhar)
        const { error: logAttemptError } = await supabase
          .from("login_attempts")
          .insert({
            user_id: userId,
            device_fingerprint: fingerprint,
            success: true,
          });
        if (logAttemptError) {
          console.warn("login_attempts insert failed:", logAttemptError);
        }

        const { error: updateProfileError } = await supabase
          .from("profiles")
          .update({
            device_fingerprint: fingerprint,
            last_device_info: deviceInfo,
            last_login_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (updateProfileError) throw updateProfileError;

        toast.warning("Dispositivo alterado", {
          description:
            "Você estava conectado em outro dispositivo. Este agora é seu dispositivo ativo. Mais trocas podem resultar em bloqueio temporário.",
          duration: 8000,
        });

        return true;
      }

      // Already had a warning, now apply ban logic
      const { data: banResult, error: banError } = await supabase.rpc(
        "record_failed_device_attempt",
        { _user_id: userId }
      );
      if (banError) throw banError;

      const banData = banResult as
        | { attempts?: number; is_banned?: boolean; ban_duration_hours?: number }
        | null;
      const attempts = banData?.attempts || currentAttempts + 1;
      const isBanned = banData?.is_banned || false;
      const banHours = banData?.ban_duration_hours || 0;

      if (isBanned) {
        toast.error("Conta temporariamente bloqueada", {
          description: `Múltiplas tentativas de acesso detectadas. Bloqueio de ${banHours} hora(s).`,
          duration: 10000,
        });
      } else {
        toast.error("Limite de trocas de dispositivo excedido", {
          description: `Por segurança, não é possível trocar de dispositivo novamente. Tentativa ${attempts}/3 antes do bloqueio temporário.`,
          duration: 8000,
        });
      }

      const { error: logFailedAttemptError } = await supabase
        .from("login_attempts")
        .insert({
          user_id: userId,
          device_fingerprint: fingerprint,
          success: false,
        });
      if (logFailedAttemptError) {
        console.warn("login_attempts insert failed:", logFailedAttemptError);
      }

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

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        session,
      }));

      if (session?.user) {
        // Use setTimeout to avoid potential deadlock
        setTimeout(async () => {
          const { isBlocked, isTempBanned, banReason, banUntil } =
            await fetchUserData(session.user.id);

          // Check for temp ban first
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

          if (isBlocked) {
            toast.error("Conta bloqueada", {
              description: "Entre em contato com o administrador.",
            });
            await supabase.auth.signOut();
            return;
          }

          // Validate device after login
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
        }));
      }
    });

    // THEN get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        session,
      }));

      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData, validateDevice]);

  // Guard: if this device becomes inactive (another device logged in), force logout.
  // Also self-heals by registering this device if there are no active sessions yet.
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
          // Se já deslogou, não faça mais chamadas.
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.user || session.user.id !== userId) return;

          const { data: current, error: currentError } = await supabase
            .from("device_sessions")
            .select("id")
            .eq("user_id", userId)
            .eq("device_fingerprint", fingerprint)
            .eq("is_active", true)
            .maybeSingle();

          if (currentError) throw currentError;

          // If this device is not active, check whether there is ANY active session.
          if (!current?.id) {
            const { data: anyActive, error: anyActiveError } = await supabase
              .from("device_sessions")
              .select("id")
              .eq("user_id", userId)
              .eq("is_active", true)
              .limit(1)
              .maybeSingle();

            if (anyActiveError) throw anyActiveError;

            // No active sessions at all: register this device (upsert to avoid unique conflicts).
            if (!anyActive?.id) {
              const { error: upsertError } = await supabase
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

              if (upsertError) throw upsertError;
              return;
            }

            // Another device is active -> logout.
            toast.error("Sessão encerrada", {
              description:
                "Sua conta foi acessada em outro dispositivo. Por segurança, você foi desconectado.",
              duration: 10000,
            });
            await supabase.auth.signOut();
            return;
          }

          // Keep last_seen fresh
          await supabase
            .from("device_sessions")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", current.id);
        } catch (err) {
          console.error("Device session guard error:", err);
        }
      };

      // Run once immediately, then poll.
      await tick();
      intervalId = window.setInterval(tick, 8000);
    })();

    return () => {
      isCancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [state.user?.id, state.session]);

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

      // Enforce single-device rule
      const ok = await validateDevice(data.user.id);
      if (!ok) {
        throw new Error(
          "Acesso negado: sua conta já está ativa em outro dispositivo."
        );
      }
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