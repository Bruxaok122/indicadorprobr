import { AppLayout } from "@/components/layout/AppLayout";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";
import { useContacts } from "@/hooks/useContacts";
import { useAuthContext } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Users,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
  CalendarClock,
  Zap,
  TrendingUp,
  Clock,
  Send,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { motion } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 0, y: 24, rotateX: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const floatVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.3 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

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

  const recentContacts = contacts.slice(0, 5);

  const statCards = [
    { label: "Contatos", value: stats.total, icon: Users, gradient: "from-blue-500 to-blue-600", glow: "shadow-blue-500/20", href: isAdmin ? "/contatos" : "/conversas" },
    { label: "Novos", value: stats.novos, icon: Zap, gradient: "from-cyan-500 to-teal-500", glow: "shadow-cyan-500/20" },
    { label: "Aguardando", value: stats.aguardando, icon: Clock, gradient: "from-amber-500 to-orange-500", glow: "shadow-amber-500/20" },
    { label: "Respondidos", value: stats.respondidos, icon: TrendingUp, gradient: "from-emerald-500 to-green-600", glow: "shadow-emerald-500/20" },
  ];

  return (
    <AppLayout>
      <div className="flex h-screen flex-col overflow-hidden bg-muted dark:bg-background">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="shrink-0 px-4 md:px-6 pt-5 pb-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                {profile ? `Olá, ${profile.full_name.split(" ")[0]}` : "Painel"}
                <motion.span
                  animate={{ rotate: [0, 14, -8, 14, 0] }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                >
                  👋
                </motion.span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Gerencie suas comunicações</p>
            </div>
            <Button asChild size="sm" className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 gap-1.5 transition-all hover:scale-105 hover:shadow-emerald-500/40">
              <Link to="/conversas"><Send className="h-3.5 w-3.5" /> Conversas</Link>
            </Button>
          </div>
        </motion.div>

        <div className="flex-1 overflow-auto px-3 md:px-5 pb-6 scrollbar-thin">
          <div className="mx-auto max-w-5xl space-y-4 mt-3" style={{ perspective: "1200px" }}>

            {/* Status banners */}
            {canUseSharedApi && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 px-4 py-3 shadow-sm backdrop-blur-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">Conta Ativa</p>
                  <p className="text-xs text-muted-foreground">Tudo pronto para enviar mensagens</p>
                </div>
                <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
              </motion.div>
            )}

            {profile?.subscription_plan && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm backdrop-blur-sm",
                  profile.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()
                    ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                    : "border-red-500/20 bg-red-500/5 dark:bg-red-500/10"
                )}
              >
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
              </motion.div>
            )}

            {!hasApiAccess && !configLoading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 px-4 py-3 shadow-sm backdrop-blur-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">Configuração Pendente</p>
                  <p className="text-xs text-muted-foreground">Contate o administrador para configurar</p>
                </div>
              </motion.div>
            )}

            {/* 3D Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {statCards.map((s, i) => {
                const Icon = s.icon;
                const inner = (
                  <motion.div
                    key={s.label}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={cardVariants}
                    whileHover={{
                      y: -6,
                      rotateX: -2,
                      rotateY: 3,
                      scale: 1.03,
                      transition: { duration: 0.25 },
                    }}
                    className={cn(
                      "group relative rounded-2xl bg-card dark:bg-card border border-border/50 p-4 cursor-pointer",
                      "shadow-lg hover:shadow-xl transition-shadow duration-300",
                      `hover:${s.glow}`
                    )}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    {/* Gradient accent line */}
                    <div className={cn("absolute top-0 left-4 right-4 h-0.5 rounded-full bg-gradient-to-r opacity-60 group-hover:opacity-100 transition-opacity", s.gradient)} />
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", s.gradient)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <motion.p
                      className="text-3xl font-extrabold text-foreground tracking-tight"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.1, type: "spring", stiffness: 200 }}
                    >
                      {s.value}
                    </motion.p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</p>
                  </motion.div>
                );
                return s.href ? <Link key={s.label} to={s.href}>{inner}</Link> : <div key={s.label}>{inner}</div>;
              })}
            </div>

            {/* Recent Contacts */}
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={floatVariants}
              className="rounded-2xl bg-card dark:bg-card border border-border/50 shadow-lg overflow-hidden"
            >
              <div className="px-4 pt-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md">
                      <Users className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">Contatos Recentes</h3>
                      <p className="text-xs text-muted-foreground">Últimas atualizações</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button asChild variant="ghost" size="sm" className="rounded-full text-xs text-muted-foreground hover:text-foreground gap-1">
                      <Link to="/contatos">Ver todos <ArrowRight className="h-3 w-3" /></Link>
                    </Button>
                  )}
                </div>
              </div>
              <div className="px-3 pb-3">
                {recentContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/50 mb-3"
                    >
                      <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
                    </motion.div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhum contato ainda</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Seus contatos aparecerão aqui</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentContacts.map((contact, i) => (
                      <motion.div
                        key={contact.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.06 }}
                      >
                        <Link
                          to={`/conversas?contact=${contact.id}`}
                          className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-all hover:bg-muted/80 border border-transparent hover:border-border/50 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 shrink-0 group-hover:scale-105 transition-transform">
                              <span className="text-sm font-bold text-foreground/70">{contact.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{contact.process_number || contact.phone}</p>
                            </div>
                          </div>
                          <StatusBadge status={contact.status} />
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
