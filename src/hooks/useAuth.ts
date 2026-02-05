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
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    role: null,
    isLoading: true,
    isBlocked: false,
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

      setState(prev => ({
        ...prev,
        profile: profile as Profile,
        role: userRole,
        isBlocked,
        isLoading: false,
      }));

      return { profile, isBlocked };
    } catch (error) {
      console.error("Error fetching user data:", error);
      setState(prev => ({ ...prev, isLoading: false }));
      return { profile: null, isBlocked: false };
    }
  }, []);

  const validateDevice = useCallback(async (userId: string) => {
    try {
      const fingerprint = await generateDeviceFingerprint();
      const deviceInfo = getDeviceInfo();

      // Check if device is registered
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
        return true;
      }

      // If user has another active device, deny access
      if (existingSessions && existingSessions.length > 0) {
        toast.error("Conta já conectada em outro dispositivo", {
          description: "Por segurança, apenas um dispositivo pode estar conectado por vez.",
        });
        await supabase.auth.signOut();
        return false;
      }

      // Register this device
      await supabase.from("device_sessions").insert({
        user_id: userId,
        device_fingerprint: fingerprint,
        device_info: deviceInfo,
        is_active: true,
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
            const { isBlocked } = await fetchUserData(session.user.id);
            
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
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