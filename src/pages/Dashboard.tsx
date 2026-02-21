import { AppLayout } from "@/components/layout/AppLayout";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";
import { useContacts } from "@/hooks/useContacts";
import { useAuthContext } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  CheckCircle,
  MessageSquare,
  Users,
  Settings,
  Upload,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
  CalendarClock,
  Zap,
  TrendingUp,
  Clock,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { isConfigured, isLoading: configLoading } = useWhatsAppConfig();
  const { contacts, isLoading: contactsLoading } = useContacts();
  const { profile, isAdmin } = useAuthContext();

  const canUseSharedApi = profile?.can_use_shared_api || isAdmin;
  const hasApiAccess = isConfigured || canUseSharedApi;

  const stats = {
    total: contacts.length,
    novos: contacts.filter((c) => c.status === "novo").length,
    aguardando: contacts.filter((c) => c.status === "aguardando").length,
    respondidos: contacts.filter((c) => c.status === "respondido").length,
  };

  const steps = [
    { title: "Configurar WhatsApp API", description: "Conecte sua conta Business", completed: hasApiAccess, href: "/configuracao", icon: Settings },
    { title: "Importar Contatos", description: "Importe sua lista de clientes", completed: contacts.length > 0, href: "/importar", icon: Upload },
    { title: "Enviar Mensagens", description: "Inicie as conversas", completed: false, href: "/conversas", icon: MessageSquare },
  ];

  const recentContacts = contacts.slice(0, 5);

  const statCards = [
    { label: "Contatos", value: stats.total, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10", href: "/contatos" },
    { label: "Novos", value: stats.novos, icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Aguardando", value: stats.aguardando, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Respondidos", value: stats.respondidos, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  ];

  return (
    <AppLayout>
      <div className="flex h-screen flex-col overflow-hidden bg-muted dark:bg-background">
        {/* Compact header */}
        <div className="shrink-0 px-4 md:px-6 pt-5 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                {profile ? `Olá, ${profile.full_name.split(" ")[0]}` : "Painel"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Gerencie suas comunicações</p>
            </div>
            <Button asChild size="sm" className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md gap-1.5">
              <Link to="/conversas"><Send className="h-3.5 w-3.5" /> Conversas</Link>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-3 md:px-5 pb-6 scrollbar-thin">
          <div className="mx-auto max-w-5xl space-y-4 mt-3">

            {/* Status banners */}
            {canUseSharedApi && (
              <motion.div animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 px-4 py-3 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">Conta Ativa</p>
                  <p className="text-xs text-muted-foreground">Tudo pronto para enviar mensagens</p>
                </div>
              </motion.div>
            )}

            {profile?.subscription_plan && (
              <div className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm",
                profile.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()
                  ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                  : "border-red-500/20 bg-red-500/5 dark:bg-red-500/10"
              )}>
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-full",
                  profile.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()
                    ? "bg-emerald-500/15" : "bg-red-500/15"
                )}>
                  <CalendarClock className={cn("h-4.5 w-4.5",
                    profile.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()
                      ? "text-emerald-400" : "text-red-400"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">
                    Plano {profile.subscription_plan === "semanal" ? "Semanal" : "Mensal"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profile.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()
                      ? `Válido até ${format(new Date(profile.subscription_expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                      : "Plano expirado. Contate o administrador."}
                  </p>
                </div>
              </div>
            )}

            {!hasApiAccess && !configLoading && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 px-4 py-3 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">Configuração Pendente</p>
                  <p className="text-xs text-muted-foreground">Configure a API do WhatsApp para começar</p>
                </div>
                <Button asChild variant="outline" size="sm" className="rounded-full text-xs shrink-0">
                  <Link to="/configuracao">Configurar</Link>
                </Button>
              </div>
            )}

            {/* Stats grid — floating cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {statCards.map((s) => {
                const Icon = s.icon;
                const inner = (
                  <div key={s.label} className="group relative rounded-2xl bg-card dark:bg-card border border-border/50 p-4 shadow-sm hover:shadow-md transition-all hover:border-border cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", s.bg)}>
                        <Icon className={cn("h-4.5 w-4.5", s.color)} />
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </div>
                    <p className="text-2xl font-bold text-foreground tracking-tight">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                );
                return s.href ? <Link key={s.label} to={s.href}>{inner}</Link> : <div key={s.label}>{inner}</div>;
              })}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {/* Setup checklist — floating panel */}
              <div className="rounded-2xl bg-card dark:bg-card border border-border/50 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">Primeiros Passos</h3>
                      <p className="text-xs text-muted-foreground">Configure seu sistema</p>
                    </div>
                  </div>
                </div>
                <div className="px-3 pb-3 space-y-1.5">
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <Link key={step.href} to={step.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-3 transition-all",
                          step.completed
                            ? "bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15"
                            : "hover:bg-muted/80 border border-transparent hover:border-border/50"
                        )}
                      >
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full shrink-0 text-xs font-bold",
                          step.completed ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                        )}>
                          {step.completed ? <CheckCircle className="h-4 w-4" /> : index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium", step.completed && "text-emerald-600 dark:text-emerald-400")}>{step.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Recent contacts — floating panel */}
              <div className="rounded-2xl bg-card dark:bg-card border border-border/50 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10">
                      <Users className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">Contatos Recentes</h3>
                      <p className="text-xs text-muted-foreground">Últimas atualizações</p>
                    </div>
                  </div>
                </div>
                <div className="px-3 pb-3">
                  {recentContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                        <Users className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">Nenhum contato ainda</p>
                      <Button asChild variant="link" size="sm" className="mt-1 text-xs">
                        <Link to="/importar">Importar lista</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {recentContacts.map((contact) => (
                        <Link key={contact.id} to={`/conversas?contact=${contact.id}`}
                          className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-all hover:bg-muted/80 border border-transparent hover:border-border/50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/20 to-blue-400/20 shrink-0">
                              <span className="text-xs font-bold text-foreground/70">{contact.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{contact.process_number || contact.phone}</p>
                            </div>
                          </div>
                          <StatusBadge status={contact.status} />
                        </Link>
                      ))}
                      <Button asChild variant="ghost" size="sm" className="w-full mt-1 rounded-xl text-xs text-muted-foreground hover:text-foreground">
                        <Link to="/contatos">Ver todos →</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
