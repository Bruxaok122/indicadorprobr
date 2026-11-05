import { supabase } from "@/integrations/supabase/client";
import { generateDeviceFingerprint, getDeviceInfo } from "@/lib/deviceFingerprint";

export const ADMIN_BLOCK_MESSAGE = "Entre em contato com o administrador";
export interface AdminAccessResult { allowed: boolean; reason?: "blocked" | "logged_out"; computer_id?: string }

export function adminAccessDenied(result: AdminAccessResult): boolean {
  return result.allowed !== true;
}

export async function checkAdminComputer(): Promise<AdminAccessResult> {
  const { data, error } = await supabase.rpc("check_admin_computer", {
    p_fingerprint: await generateDeviceFingerprint(), p_device_info: getDeviceInfo(),
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.allowed !== "boolean") {
    throw new Error("Não foi possível validar o acesso administrativo");
  }
  return data as unknown as AdminAccessResult;
}