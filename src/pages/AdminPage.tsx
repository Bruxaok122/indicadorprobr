import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Users, UserPlus, Radio, Mic, HeartPulse, Zap, Activity, Eye, List, Phone, Scale, LogOut, RefreshCw, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuthContext } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatsCards } from "@/components/admin/StatsCards";
import { UserCard } from "@/components/admin/UserCard";
import { UsersTable } from "@/components/admin/UsersTable";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { PhoneNumbersSection } from "@/components/admin/PhoneNumbersSection";

import { PhonePermissionsDialog } from "@/components/admin/PhonePermissionsDialog";
import { AdminChatMonitor } from "@/components/admin/AdminChatMonitor";
import { ApiHealthMonitor } from "@/components/admin/ApiHealthMonitor";
import { Profile } from "@/types/juriszap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DispatchProvider, useDispatchContext } from "@/contexts/DispatchContext";
import AdminDisparosPage from "@/pages/AdminDisparosPage";
import AdminContatosPage from "@/pages/AdminContatosPage";
import AdminAudioPage from "@/pages/AdminAudioPage";
import { ApiConfigsSection } from "@/components/admin/ApiConfigsSection";
import { DispatchMonitor } from "@/components/admin/DispatchMonitor";
import { FailureRateCard } from "@/components/admin/FailureRateCard";
import { RealtimeMonitorPanel } from "@/components/admin/RealtimeMonitorPanel";

function AdminPageInner() {
  const navigate = useNavigate();
  const { signOut } = useAuthContext();
  const isMobile = useIsMobile();
  const {
    users,
    isLoadingUsers,
    stats,
    isLoadingStats,
    refreshAll,
    createUser,
    isCreatingUser,
    toggleBlock,
    toggleApiPermission,
    toggleManageNumbers,
    toggleDispatch,
    toggleBypassCooldown,
    deleteUser,
    clearTempBan,
    setSubscriptionPlan,
    authorizeDevice,
    resetDevice,
    setMaxBatchSize,
  } = useAdmin();

  const {
    allPhones,
    getUserPermissions,
    updatePermissions,
    isUpdatingPermissions,
  } = useWabaPhones();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [phonePermUser, setPhonePermUser] = useState<Profile | null>(null);
  const [monitorUser, setMonitorUser] = useState<Profile | null>(null);
  const [userToDeleteMobile, setUserToDeleteMobile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState("tempo-real");

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const navGroups = [
    {
      label: "Geral",
      items: [
        { value: "tempo-real", title: "Tempo Real", desc: "Monitoramento ao vivo dos operadores", icon: Eye },
        { value: "usuarios", title: "Usuários", desc: "Crie, bloqueie e gerencie permissões", icon: Users },
        { value: "contatos", title: "Listas", desc: "Listas de contatos importadas", icon: List },
        { value: "disparos", title: "Disparos", desc: "Envio de templates em massa", icon: Radio },
        { value: "acompanhamento", title: "Acompanhamento", desc: "Status dos disparos em andamento", icon: Activity },
      ],
    },
    {
      label: "Infraestrutura",
      items: [
        { value: "apis", title: "APIs", desc: "Configurações das APIs do WhatsApp", icon: Zap },
        { value: "saude", title: "Saúde API", desc: "Taxa de falhas e qualidade", icon: HeartPulse },
        { value: "numeros", title: "Números", desc: "Números de WhatsApp conectados", icon: Phone },
        { value: "audio", title: "Áudio", desc: "Áudios atribuídos aos operadores", icon: Mic },
      ],
    },
  ];
  const allItems = navGroups.flatMap((g) => g.items);
  const current = allItems.find((i) => i.value === activeTab) ?? allItems[0];
  const today = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="dark flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Scale className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">JurisZap</p>
            <p className="text-[11px] text-muted-foreground">Painel administrativo</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-6" aria-label="Navegação do admin">
          {navGroups.map((g) => (
            <div key={g.label}>
              <p className="px-3 mb-2 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">{g.label}</p>
              <div className="space-y-1">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.value === activeTab;
                  return (
                    <button
                      key={item.value}
                      onClick={() => setActiveTab(item.value)}
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "bg-primary/15 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
                      <Icon className="h-4 w-4" />
                      {item.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/80 text-xs font-bold text-primary-foreground">AD</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">Administrador</p>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Conectado
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto bg-gradient-to-b from-primary/10 via-background to-background">
        {/* Mobile nav */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 overflow-x-auto border-b border-border bg-card/80 backdrop-blur px-3 py-2">
          {allItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                onClick={() => setActiveTab(item.value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs",
                  item.value === activeTab ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {item.title}
              </button>
            );
          })}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleLogout} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{current.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{current.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">
                <CalendarDays className="h-3.5 w-3.5" /> Hoje · {today}
              </span>
              <Button size="sm" className="rounded-full" onClick={refreshAll}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
              </Button>
            </div>
          </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="tempo-real" className="mt-0">
            <RealtimeMonitorPanel />
          </TabsContent>

          <TabsContent value="apis" className="mt-0">
            <ApiConfigsSection />
          </TabsContent>

          <TabsContent value="saude" className="mt-0 space-y-4">
            <FailureRateCard />
            <ApiHealthMonitor />
          </TabsContent>

          <TabsContent value="usuarios" className="mt-0 space-y-4">
            <StatsCards stats={stats} isLoading={isLoadingStats} />
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>Gerenciar Usuários</CardTitle>
                    <CardDescription>Crie, bloqueie e gerencie permissões dos usuários</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
                    <UserPlus className="mr-2 h-4 w-4" /> Novo Usuário
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" text="Carregando usuários..." />
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Users className="mb-4 h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50" />
                    <p className="text-lg font-medium text-muted-foreground">Nenhum usuário cadastrado</p>
                    <Button onClick={() => setShowCreateDialog(true)} className="mt-4 w-full sm:w-auto">
                      <UserPlus className="mr-2 h-4 w-4" /> Criar primeiro usuário
                    </Button>
                  </div>
                ) : isMobile ? (
                  <div className="grid gap-3">
                    {users.map((user) => (
                      <UserCard
                        key={user.id}
                        user={user}
                        onToggleBlock={toggleBlock}
                        onToggleApiPermission={toggleApiPermission}
                        onToggleManageNumbers={toggleManageNumbers}
                        onToggleDispatch={toggleDispatch}
                        onToggleBypassCooldown={toggleBypassCooldown}
                        onDelete={setUserToDeleteMobile}
                        onClearTempBan={clearTempBan}
                        onManagePhones={setPhonePermUser}
                        onSetPlan={setSubscriptionPlan}
                        onAuthorizeDevice={authorizeDevice}
                        onResetDevice={resetDevice}
                        onMonitorChat={setMonitorUser}
                        onSetMaxBatchSize={setMaxBatchSize}
                      />
                    ))}
                  </div>
                ) : (
                  <UsersTable
                    users={users}
                    onToggleBlock={toggleBlock}
                    onToggleApiPermission={toggleApiPermission}
                    onToggleManageNumbers={toggleManageNumbers}
                    onToggleDispatch={toggleDispatch}
                    onToggleBypassCooldown={toggleBypassCooldown}
                    onDelete={deleteUser}
                    onClearTempBan={clearTempBan}
                    onManagePhones={setPhonePermUser}
                    onSetPlan={setSubscriptionPlan}
                    onAuthorizeDevice={authorizeDevice}
                    onResetDevice={resetDevice}
                    onMonitorChat={setMonitorUser}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="numeros" className="mt-0 space-y-4">
            <PhoneNumbersSection />
          </TabsContent>

          <TabsContent value="contatos" className="mt-0">
            <AdminContatosPage />
          </TabsContent>

          <TabsContent value="audio" className="mt-0">
            <AdminAudioPage />
          </TabsContent>

          <TabsContent value="disparos" className="mt-0">
            {/* Altura fixa + rolagem interna: evita que a página cresça/redimensione */}
            <div className="h-[calc(100dvh-11rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card/30 p-3 md:p-4 [scrollbar-gutter:stable]">
              <AdminDisparosPage />
            </div>
          </TabsContent>

          <TabsContent value="acompanhamento" className="mt-0">
            <DispatchMonitor />
          </TabsContent>
        </Tabs>
        </motion.div>
        </div>
      </main>


      <CreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreate={createUser}
        isCreating={isCreatingUser}
      />

      <PhonePermissionsDialog
        open={!!phonePermUser}
        onOpenChange={(open) => !open && setPhonePermUser(null)}
        user={phonePermUser}
        phones={allPhones}
        getUserPermissions={getUserPermissions}
        onSave={updatePermissions}
        isSaving={isUpdatingPermissions}
      />

      <AdminChatMonitor
        open={!!monitorUser}
        onOpenChange={(open) => !open && setMonitorUser(null)}
        user={monitorUser}
      />

      {/* Mobile delete confirmation dialog */}
      <AlertDialog open={!!userToDeleteMobile} onOpenChange={(open) => !open && setUserToDeleteMobile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O usuário{" "}
              <strong>{userToDeleteMobile?.full_name}</strong> ({userToDeleteMobile?.email}) e todos os seus dados serão
              removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (userToDeleteMobile) {
                  deleteUser(userToDeleteMobile.user_id);
                  setUserToDeleteMobile(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminPage() {
  return (
    <DispatchProvider>
      <AdminPageInner />
    </DispatchProvider>
  );
}
