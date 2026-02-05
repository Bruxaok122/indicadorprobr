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
      const fingerprint = await generateDeviceFingerprint();
      const deviceInfo = getDeviceInfo();

      // Check ALL active sessions for this user
      const { data: existingSessions } = await supabase
        .from("device_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      // Check if this device is already registered
      const currentDevice = existingSessions?.find(
        (s) => s.device_fingerprint === fingerprint
      );

      if (currentDevice) {
        // Update last seen
        await supabase
          .from("device_sessions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", currentDevice.id);
        
        // Clear failed attempts on successful login
        await supabase.rpc("clear_failed_attempts", { _user_id: userId });
        return true;
      }

      // If user has another active device, record failed attempt and deny access
      if (existingSessions && existingSessions.length > 0) {
        // Record the failed attempt and check if should be banned
        const { data: banResult } = await supabase.rpc("record_failed_device_attempt", { 
          _user_id: userId 
        });
        
        const banData = banResult as { attempts?: number; is_banned?: boolean; ban_duration_hours?: number } | null;
        const attempts = banData?.attempts || 1;
        const isBanned = banData?.is_banned || false;
        const banHours = banData?.ban_duration_hours || 0;
        
        if (isBanned) {
          toast.error("Conta temporariamente bloqueada", {
            description: `Múltiplas tentativas de acesso detectadas. Bloqueio de ${banHours} hora(s).`,
            duration: 10000,
          });
        } else {
          toast.error("Conta já conectada em outro dispositivo", {
            description: `Por segurança, apenas um dispositivo pode estar conectado por vez. Tentativa ${attempts}/3 antes do bloqueio temporário.`,
            duration: 8000,
          });
        }
        
        // Log the attempt
        await supabase.from("login_attempts").insert({
          user_id: userId,
          device_fingerprint: fingerprint,
          success: false,
        });
        
        await supabase.auth.signOut();
        return false;
      }

      // Register this device as the only active one
      await supabase.from("device_sessions").insert({
        user_id: userId,
        device_fingerprint: fingerprint,
        device_info: deviceInfo,
        is_active: true,
      });
      
      // Log successful attempt
      await supabase.from("login_attempts").insert({
        user_id: userId,
        device_fingerprint: fingerprint,
        success: true,
      });

      // Update profile with device info
      await supabase
        .from("profiles")
        .update({
          device_fingerprint: fingerprint,
          last_device_info: deviceInfo,
          last_login_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      
      // Clear failed attempts on successful login
      await supabase.rpc("clear_failed_attempts", { _user_id: userId });

      return true;
    } catch (error) {
      console.error("Error validating device:", error);
      return true; // Allow on error to not block users
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session,
        }));

        if (session?.user) {
          // Use setTimeout to avoid potential deadlock
          setTimeout(async () => {
            const { isBlocked, isTempBanned, banReason, banUntil } = await fetchUserData(session.user.id);
            
            // Check for temp ban first
            if (isTempBanned && banUntil) {
              const hoursLeft = Math.ceil((banUntil.getTime() - Date.now()) / (1000 * 60 * 60));
              toast.error("Conta temporariamente bloqueada", {
                description: `${banReason || 'Atividade suspeita detectada'}. Tempo restante: ${hoursLeft} hora(s).`,
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
            if (event === 'SIGNED_IN') {
              await validateDevice(session.user.id);
            }
          }, 0);
        } else {
          setState(prev => ({
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
      }
    );

    // THEN get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        user: session?.user ?? null,
        session,
      }));

      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData, validateDevice]);

  const signIn = async (email: string, password: string) => {
    // Check if user is temp banned before attempting login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    
    // After successful auth, check temp ban status
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("temp_banned_until, ban_reason")
        .eq("user_id", data.user.id)
        .single();
        
      if (profile?.temp_banned_until && new Date(profile.temp_banned_until) > new Date()) {
        const banUntil = new Date(profile.temp_banned_until);
        const hoursLeft = Math.ceil((banUntil.getTime() - Date.now()) / (1000 * 60 * 60));
        await supabase.auth.signOut();
        throw new Error(`Conta temporariamente bloqueada. ${profile.ban_reason || 'Atividade suspeita detectada'}. Tempo restante: ${hoursLeft} hora(s).`);
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