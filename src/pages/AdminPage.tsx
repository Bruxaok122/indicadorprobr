import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Users, UserPlus, Radio, Mic, HeartPulse, PhoneCall } from "lucide-react";
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
import AdminDisparosPage from "@/pages/AdminDisparosPage";
import AdminContatosPage from "@/pages/AdminContatosPage";
import AdminAudioPage from "@/pages/AdminAudioPage";
import { WhatsAppNumberValidator } from "@/components/admin/WhatsAppNumberValidator";

export default function AdminPage() {
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

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background dark">
      <AdminHeader onLogout={handleLogout} onRefresh={refreshAll} />

      <main className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <StatsCards stats={stats} isLoading={isLoadingStats} />

        <Tabs defaultValue="saude">
          <TabsList className="w-full sm:w-auto flex-wrap">
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
            <TabsTrigger value="validador" className="gap-1.5">
              <PhoneCall className="h-4 w-4" /> Validador
            </TabsTrigger>
          </TabsList>


          <TabsContent value="saude" className="mt-4">
            <ApiHealthMonitor />
          </TabsContent>

          <TabsContent value="usuarios" className="mt-4">
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
                        onDelete={deleteUser}
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

          <TabsContent value="numeros" className="mt-4">
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

          <TabsContent value="validador" className="mt-4">
            <WhatsAppNumberValidator />
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
    </div>
  );
}
