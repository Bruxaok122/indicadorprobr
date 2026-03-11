import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Users, UserPlus, Radio, Mic, HeartPulse, Zap, Activity, FileText, BotMessageSquare } from "lucide-react";
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
import { AdminFichasPanel } from "@/components/admin/AdminFichasPanel";
import { AITestPanel } from "@/components/admin/AITestPanel";
import { FailureRateCard } from "@/components/admin/FailureRateCard";

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
    deleteUser,
    clearTempBan,
    setSubscriptionPlan,
    authorizeDevice,
    resetDevice,
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
  const [activeTab, setActiveTab] = useState("apis");

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background dark">
      <AdminHeader onLogout={handleLogout} onRefresh={refreshAll} />

      <main className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <Tabs defaultValue="apis" onValueChange={(v) => setActiveTab(v)}>
          <TabsList className="w-full sm:w-auto flex-wrap">
            <TabsTrigger value="apis" className="gap-1.5">
              <Zap className="h-4 w-4" /> APIs
            </TabsTrigger>
            <TabsTrigger value="saude" className="gap-1.5">
              <HeartPulse className="h-4 w-4" /> Saúde API
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-1.5">
              <Users className="h-4 w-4" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="numeros" className="gap-1.5">
              Números
            </TabsTrigger>
            <TabsTrigger value="contatos" className="gap-1.5">
              Contatos
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-1.5">
              <Mic className="h-4 w-4" /> Áudio
            </TabsTrigger>
            <TabsTrigger value="disparos" className="gap-1.5">
              <Radio className="h-4 w-4" /> Disparos
            </TabsTrigger>
            <TabsTrigger value="acompanhamento" className="gap-1.5">
              <Activity className="h-4 w-4" /> Acompanhamento
            </TabsTrigger>
            <TabsTrigger value="fichas" className="gap-1.5">
              <FileText className="h-4 w-4" /> Fichas
            </TabsTrigger>
            <TabsTrigger value="teste-ia" className="gap-1.5">
              <BotMessageSquare className="h-4 w-4" /> Teste IA
            </TabsTrigger>
          </TabsList>


          <TabsContent value="apis" className="mt-4">
            <ApiConfigsSection />
          </TabsContent>

          <TabsContent value="saude" className="mt-4 space-y-4">
            <FailureRateCard />
            <ApiHealthMonitor />
          </TabsContent>

          <TabsContent value="usuarios" className="mt-4 space-y-4">
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
                        onDelete={setUserToDeleteMobile}
                        onClearTempBan={clearTempBan}
                        onManagePhones={setPhonePermUser}
                        onSetPlan={setSubscriptionPlan}
                        onAuthorizeDevice={authorizeDevice}
                        onResetDevice={resetDevice}
                        onMonitorChat={setMonitorUser}
                      />
                    ))}
                  </div>
                ) : (
                  <UsersTable
                    users={users}
                    onToggleBlock={toggleBlock}
                    onToggleApiPermission={toggleApiPermission}
                    onToggleManageNumbers={toggleManageNumbers}
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

          <TabsContent value="numeros" className="mt-4 space-y-4">
            <PhoneNumbersSection />
          </TabsContent>

          <TabsContent value="contatos" className="mt-4">
            <AdminContatosPage />
          </TabsContent>

          <TabsContent value="audio" className="mt-4">
            <AdminAudioPage />
          </TabsContent>

          <TabsContent value="disparos" className="mt-4">
            <AdminDisparosPage />
          </TabsContent>

          <TabsContent value="acompanhamento" className="mt-4">
            <DispatchMonitor />
          </TabsContent>

          <TabsContent value="fichas" className="mt-4">
            <AdminFichasPanel />
          </TabsContent>

          <TabsContent value="teste-ia" className="mt-4">
            <AITestPanel />
          </TabsContent>


        </Tabs>

        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Desenvolvido por <span className="font-semibold text-accent">LB013</span>
          </p>
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
