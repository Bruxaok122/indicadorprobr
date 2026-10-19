import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Users, UserPlus, Radio, Mic, HeartPulse, Zap, Activity, FileText, BotMessageSquare, Eye, Phone, Contact } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminShell, AdminNavItem } from "@/components/admin/AdminShell";
import { StatsCards } from "@/components/admin/StatsCards";
import { UserCard } from "@/components/admin/UserCard";
import { UsersTable } from "@/components/admin/UsersTable";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { PhoneNumbersSection } from "@/components/admin/PhoneNumbersSection";

import { PhonePermissionsDialog } from "@/components/admin/PhonePermissionsDialog";
import { AdminChatMonitor } from "@/components/admin/AdminChatMonitor";
import { ApiHealthMonitor } from "@/components/admin/ApiHealthMonitor";
import { Profile } from "@/types/juriszap";
import { DispatchProvider, useDispatchContext } from "@/contexts/DispatchContext";
import AdminDisparosPage from "@/pages/AdminDisparosPage";
import AdminContatosPage from "@/pages/AdminContatosPage";
import AdminAudioPage from "@/pages/AdminAudioPage";
import { ApiConfigsSection } from "@/components/admin/ApiConfigsSection";
import { DispatchMonitor } from "@/components/admin/DispatchMonitor";
import { AdminFichasPanel } from "@/components/admin/AdminFichasPanel";
import { AITestPanel } from "@/components/admin/AITestPanel";
import { FailureRateCard } from "@/components/admin/FailureRateCard";
import { RealtimeMonitorPanel } from "@/components/admin/RealtimeMonitorPanel";

const NAV_ITEMS: AdminNavItem[] = [
  { value: "tempo-real", label: "Tempo Real", description: "Acompanhe operadores e conversas ao vivo", icon: Eye, group: "Geral" },
  { value: "acompanhamento", label: "Acompanhamento", description: "Progresso dos disparos em andamento", icon: Activity, group: "Geral" },
  { value: "disparos", label: "Disparos", description: "Configure e inicie envios de templates", icon: Radio, group: "Geral" },
  { value: "contatos", label: "Listas", description: "Listas importadas e contatos dos clientes", icon: Contact, group: "Geral" },
  { value: "fichas", label: "Fichas", description: "Dados coletados prontos para exportar", icon: FileText, group: "Geral" },
  { value: "usuarios", label: "Usuários", description: "Crie, bloqueie e gerencie permissões", icon: Users, group: "Gestão" },
  { value: "numeros", label: "Números", description: "Números do WhatsApp conectados", icon: Phone, group: "Gestão" },
  { value: "audio", label: "Áudio", description: "Áudios atribuídos aos operadores", icon: Mic, group: "Gestão" },
  { value: "apis", label: "APIs", description: "Contas da Meta e API ativa", icon: Zap, group: "Sistema" },
  { value: "saude", label: "Saúde API", description: "Taxa de falhas e qualidade das contas", icon: HeartPulse, group: "Sistema" },
  { value: "teste-ia", label: "Teste IA", description: "Ambiente de testes do assistente", icon: BotMessageSquare, group: "Sistema" },
];

function AdminPageInner() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuthContext();
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

  return (
    <>
      <AdminShell
        items={NAV_ITEMS}
        active={activeTab}
        onChange={setActiveTab}
        onLogout={handleLogout}
        onRefresh={refreshAll}
        userName={profile?.full_name || undefined}
      >
          {activeTab === "tempo-real" && (<div className="">
            <RealtimeMonitorPanel />
          </div>)}

          {activeTab === "apis" && (<div className="">
            <ApiConfigsSection />
          </div>)}

          {activeTab === "saude" && (<div className="space-y-4">
            <FailureRateCard />
            <ApiHealthMonitor />
          </div>)}

          {activeTab === "usuarios" && (<div className="space-y-4">
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
          </div>)}

          {activeTab === "numeros" && (<div className="space-y-4">
            <PhoneNumbersSection />
          </div>)}

          {activeTab === "contatos" && (<div className="">
            <AdminContatosPage />
          </div>)}

          {activeTab === "audio" && (<div className="">
            <AdminAudioPage />
          </div>)}

          {activeTab === "disparos" && (<div className="">
            <AdminDisparosPage />
          </div>)}

          {activeTab === "acompanhamento" && (<div className="">
            <DispatchMonitor />
          </div>)}

          {activeTab === "fichas" && (<div className="">
            <AdminFichasPanel />
          </div>)}

          {activeTab === "teste-ia" && (<div className="">
            <AITestPanel />
          </div>)}


      </AdminShell>

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
    </>
  );
}

export default function AdminPage() {
  return (
    <DispatchProvider>
      <AdminPageInner />
    </DispatchProvider>
  );
}
