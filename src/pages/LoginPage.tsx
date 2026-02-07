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
        {/* Left — Glass login card */}
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10 lg:justify-end lg:pr-8 xl:pr-16">
          <LoginGlassCard />
        </div>

        {/* Right — Lawyer hero image */}
        <div className="flex-1">
          <LoginHeroImage />
        </div>
      </div>
    </div>
  );
}
