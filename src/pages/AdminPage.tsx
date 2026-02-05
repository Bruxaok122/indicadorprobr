import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Users, UserPlus } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatsCards } from "@/components/admin/StatsCards";
import { UserCard } from "@/components/admin/UserCard";
import { UsersTable } from "@/components/admin/UsersTable";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";

export default function AdminPage() {
  const navigate = useNavigate();
  const { signOut } = useAuthContext();
  const isMobile = useIsMobile();
  const {
    users,
    isLoadingUsers,
    stats,
    isLoadingStats,
    createUser,
    isCreatingUser,
    toggleBlock,
    toggleApiPermission,
    deleteUser,
    clearTempBan,
  } = useAdmin();

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader onLogout={handleLogout} />

      <main className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <StatsCards stats={stats} isLoading={isLoadingStats} />

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>Gerenciar Usuários</CardTitle>
                <CardDescription>
                  Crie, bloqueie e gerencie permissões dos usuários
                </CardDescription>
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
                <p className="text-lg font-medium text-muted-foreground">
                  Nenhum usuário cadastrado
                </p>
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
              />
            )}
          </CardContent>
        </Card>

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
    </div>
  );
}