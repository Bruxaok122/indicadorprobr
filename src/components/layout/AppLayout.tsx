import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQualityAlarm } from "@/hooks/useQualityAlarm";
import { useAuthContext } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const { isAdmin } = useAuthContext();

  // Monitor quality rating 24/7 for admins
  useQualityAlarm(isAdmin);

  return (
    <div className={`flex min-h-screen bg-background overflow-hidden ${isMobile ? 'flex-col' : ''}`}>
      <Sidebar />
      <main className="flex-1 overflow-hidden min-w-0">{children}</main>
    </div>
  );
}
