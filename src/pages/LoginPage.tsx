import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { LoginBackground } from "@/components/login/LoginBackground";
import { LoginGlassCard } from "@/components/login/LoginGlassCard";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuthContext();

  if (isAuthenticated) {
    navigate(isAdmin ? "/administrador" : "/");
    return null;
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <LoginBackground />

      {/* Content layer */}
      <div className="relative z-10 flex w-full items-center justify-center p-6 sm:p-10">
        <LoginGlassCard />
      </div>
    </div>
  );
}
