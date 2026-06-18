import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CheckResult {
  id: string;
  label: string;
  status: "ok" | "warning" | "error";
  detail: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const checks: CheckResult[] = [];

    // 1. Check currently active WhatsApp API config
    const { data: whatsappConfig } = await supabase
      .from("api_configs")
      .select("id, waba_id, phone_number_id, access_token, is_validated")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!whatsappConfig || !whatsappConfig.access_token) {
      checks.push({
        id: "whatsapp_config",
        label: "Configuração WhatsApp",
        status: "error",
        detail: "Nenhuma configuração WhatsApp encontrada. Configure o Access Token, WABA ID e Phone Number ID.",
      });
    } else if (!whatsappConfig.is_validated) {
      checks.push({
        id: "whatsapp_config",
        label: "Configuração WhatsApp",
        status: "warning",
        detail: "Configuração existente mas não foi validada. Teste o envio antes do disparo em massa.",
      });
    } else {
      checks.push({
        id: "whatsapp_config",
        label: "Configuração WhatsApp",
        status: "ok",
        detail: "Configuração WhatsApp validada e ativa.",
      });
    }

    // 2. Check active phone numbers
    const { data: activePhones } = await supabase
      .from("waba_phone_numbers")
      .select("id, phone_number_id, display_phone_number, verified_name, quality_rating, is_active")
      .eq("api_config_id", whatsappConfig?.id || "00000000-0000-0000-0000-000000000000")
      .eq("is_active", true);

    if (!activePhones || activePhones.length === 0) {
      checks.push({
        id: "phone_numbers",
        label: "Números de Disparo",
        status: "error",
        detail: "Nenhum número de telefone ativo. Registre pelo menos um número antes de disparar.",
      });
    } else {
      const redQuality = activePhones.filter(p => p.quality_rating === "RED");
      const noName = activePhones.filter(p => !p.verified_name);
      
      if (redQuality.length > 0) {
        checks.push({
          id: "phone_numbers",
          label: "Números de Disparo",
          status: "warning",
          detail: `${activePhones.length} número(s) ativo(s), mas ${redQuality.length} com qualidade VERMELHA (${redQuality.map(p => p.display_phone_number).join(", ")}). Risco de bloqueio pela Meta.`,
        });
      } else if (noName.length > 0) {
        checks.push({
          id: "phone_numbers",
          label: "Números de Disparo",
          status: "warning",
          detail: `${activePhones.length} número(s) ativo(s), mas ${noName.length} sem Nome Verificado. Isso pode causar erro #131037.`,
        });
      } else {
        checks.push({
          id: "phone_numbers",
          label: "Números de Disparo",
          status: "ok",
          detail: `${activePhones.length} número(s) ativo(s) com qualidade OK.`,
        });
      }
    }

    // 3. Validate access token by calling Meta API
    if (whatsappConfig?.access_token && activePhones && activePhones.length > 0) {
      try {
        const testPhoneId = activePhones[0].phone_number_id;
        const tokenTestResponse = await fetch(
          `https://graph.facebook.com/v21.0/${testPhoneId}?fields=display_phone_number,verified_name,name_status`,
          {
            headers: { Authorization: `Bearer ${whatsappConfig.access_token}` },
          }
        );
        const tokenTestResult = await tokenTestResponse.json();

        if (!tokenTestResponse.ok) {
          const errorCode = tokenTestResult.error?.code;
          if (errorCode === 190) {
            checks.push({
              id: "access_token",
              label: "Token de Acesso",
              status: "error",
              detail: "Token de acesso EXPIRADO ou inválido. Gere um novo token no Meta Business Suite.",
            });
          } else {
            checks.push({
              id: "access_token",
              label: "Token de Acesso",
              status: "error",
              detail: `Erro ao validar token: ${tokenTestResult.error?.message || "desconhecido"}`,
            });
          }
        } else {
          // Check name_status
          const nameStatus = tokenTestResult.name_status;
          const validStatuses = ["APPROVED", "AVAILABLE", "AVAILABLE_WITHOUT_REVIEW"];
          if (nameStatus && !validStatuses.includes(nameStatus)) {
            checks.push({
              id: "access_token",
              label: "Token de Acesso / Display Name",
              status: "warning",
              detail: `Token válido, mas o Display Name do número ${tokenTestResult.display_phone_number} está com status "${nameStatus}". Pode causar erro #131037.`,
            });
          } else {
            checks.push({
              id: "access_token",
              label: "Token de Acesso",
              status: "ok",
              detail: `Token válido. Número: ${tokenTestResult.display_phone_number} (${tokenTestResult.verified_name || "sem nome"}).`,
            });
          }
        }
      } catch (apiErr) {
        checks.push({
          id: "access_token",
          label: "Token de Acesso",
          status: "warning",
          detail: "Não foi possível validar o token via API da Meta. Verifique sua conexão.",
        });
      }
    }

    // 4. Check templates availability
    if (whatsappConfig?.access_token && whatsappConfig?.waba_id) {
      try {
        const templatesResponse = await fetch(
          `https://graph.facebook.com/v21.0/${whatsappConfig.waba_id}/message_templates?fields=name,status&limit=100`,
          {
            headers: { Authorization: `Bearer ${whatsappConfig.access_token}` },
          }
        );
        const templatesResult = await templatesResponse.json();

        if (templatesResponse.ok && templatesResult.data) {
          const approved = templatesResult.data.filter((t: any) => t.status === "APPROVED");
          const rejected = templatesResult.data.filter((t: any) => t.status === "REJECTED");
          
          if (approved.length === 0) {
            checks.push({
              id: "templates",
              label: "Templates",
              status: "error",
              detail: "Nenhum template APROVADO encontrado. Crie e submeta templates para aprovação da Meta.",
            });
          } else {
            let detail = `${approved.length} template(s) aprovado(s) prontos para uso.`;
            if (rejected.length > 0) detail += ` ${rejected.length} rejeitado(s).`;
            checks.push({
              id: "templates",
              label: "Templates",
              status: rejected.length > 0 ? "warning" : "ok",
              detail,
            });
          }
        } else {
          checks.push({
            id: "templates",
            label: "Templates",
            status: "warning",
            detail: "Não foi possível consultar templates na Meta.",
          });
        }
      } catch {
        checks.push({
          id: "templates",
          label: "Templates",
          status: "warning",
          detail: "Falha ao consultar templates.",
        });
      }
    }

    // 5. Check contacts in pool (available for dispatch)
    const { count: poolCount } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .is("user_id", null)
      .neq("status", "encerrado");

    const { count: blockedCount } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("status", "encerrado");

    const { count: noWhatsappCount } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("has_whatsapp", false);

    checks.push({
      id: "contacts_pool",
      label: "Pool de Contatos",
      status: (poolCount || 0) > 0 ? "ok" : "warning",
      detail: `${poolCount || 0} contato(s) disponíveis no pool para disparo. ${blockedCount || 0} bloqueado(s), ${noWhatsappCount || 0} sem WhatsApp.`,
    });

    // 6. Check active operators
    const { data: operators } = await supabase
      .from("profiles")
      .select("user_id, full_name, is_blocked, subscription_expires_at")
      .eq("is_blocked", false);

    const { data: operatorRoles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const nonAdminOperators = operators?.filter(op => {
      const roles = operatorRoles?.filter(r => r.user_id === op.user_id) || [];
      return !roles.some(r => r.role === "admin");
    }) || [];

    const expiredOps = nonAdminOperators.filter(op => 
      op.subscription_expires_at && new Date(op.subscription_expires_at) < new Date()
    );

    if (nonAdminOperators.length === 0) {
      checks.push({
        id: "operators",
        label: "Operadores",
        status: "warning",
        detail: "Nenhum operador ativo encontrado. Crie operadores antes de atribuir contatos.",
      });
    } else {
      let detail = `${nonAdminOperators.length} operador(es) ativo(s).`;
      if (expiredOps.length > 0) {
        detail += ` ⚠️ ${expiredOps.length} com assinatura expirada.`;
      }
      checks.push({
        id: "operators",
        label: "Operadores",
        status: expiredOps.length > 0 ? "warning" : "ok",
        detail,
      });
    }

    // 7. Check phone permissions for operators
    const { data: permissions } = await supabase
      .from("user_phone_permissions")
      .select("user_id, phone_number_id");

    const opsWithoutPermission = nonAdminOperators.filter(op => {
      const hasAnyPermission = permissions?.some(p => p.user_id === op.user_id);
      return !hasAnyPermission;
    });

    if (nonAdminOperators.length > 0 && opsWithoutPermission.length > 0) {
      checks.push({
        id: "phone_permissions",
        label: "Permissões de Número",
        status: "warning",
        detail: `${opsWithoutPermission.length} operador(es) sem permissão de número atribuída: ${opsWithoutPermission.map(o => o.full_name).join(", ")}.`,
      });
    } else if (nonAdminOperators.length > 0) {
      checks.push({
        id: "phone_permissions",
        label: "Permissões de Número",
        status: "ok",
        detail: "Todos os operadores possuem permissão de número configurada.",
      });
    }

    // 8. Check for stale/stuck messages
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: stuckMessages } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", oneHourAgo);

    if ((stuckMessages || 0) > 10) {
      checks.push({
        id: "stuck_messages",
        label: "Mensagens Travadas",
        status: "warning",
        detail: `${stuckMessages} mensagem(ns) pendentes há mais de 1 hora. Execute "Otimizar Score" para limpar.`,
      });
    } else {
      checks.push({
        id: "stuck_messages",
        label: "Mensagens Travadas",
        status: "ok",
        detail: "Nenhuma mensagem travada detectada.",
      });
    }

    // Summary
    const errors = checks.filter(c => c.status === "error");
    const warnings = checks.filter(c => c.status === "warning");
    const allOk = errors.length === 0 && warnings.length === 0;

    let summary = "";
    if (allOk) {
      summary = "✅ Tudo pronto para o disparo! Nenhum problema detectado.";
    } else if (errors.length > 0) {
      summary = `❌ ${errors.length} problema(s) crítico(s) encontrado(s). Corrija antes de disparar.`;
    } else {
      summary = `⚠️ ${warnings.length} aviso(s). Pode disparar, mas revise os itens marcados.`;
    }

    return new Response(
      JSON.stringify({ checks, summary, canDispatch: errors.length === 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Pre-dispatch review error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
