import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { LoginBackground } from "@/components/login/LoginBackground";
import { LoginGlassCard } from "@/components/login/LoginGlassCard";
import { LoginHeroImage } from "@/components/login/LoginHeroImage";

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
      <div className="relative z-10 flex w-full flex-col lg:flex-row">
        {/* Left — Lawyer hero image */}
        <div className="hidden flex-1 lg:block">
          <LoginHeroImage />
        </div>

        {/* Right — Glass login card */}
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10 lg:justify-start lg:pl-8 xl:pl-16">
          <LoginGlassCard />
        </div>
      </div>
    </div>
  );
}
