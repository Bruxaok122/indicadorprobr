import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { LoginBackground } from "@/components/login/LoginBackground";
import { LoginGlassCard } from "@/components/login/LoginGlassCard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading, profileLoaded } = useAuthContext();

  // Espera o papel sair do banco antes de decidir o destino. Sem isso, no
  // instante do login o "isAdmin" ainda é falso e o admin cairia no chat.
  if (isAuthenticated && (isLoading || !profileLoaded)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }

  if (isAuthenticated) {
    navigate(isAdmin ? "/administrador" : "/");
    return null;
  }

  return (
    <div className="relative flex h-screen overflow-auto">
      <LoginBackground />

      {/* Content layer */}
      <div className="relative z-10 flex w-full items-center justify-center p-6 sm:p-10">
        <LoginGlassCard />
      </div>
    </div>
  );
}
