import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { OnboardingTour } from "@/components/tour/OnboardingTour";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className={`flex min-h-screen bg-background ${isMobile ? 'flex-col' : ''}`}>
      <Sidebar />
      <OnboardingTour />
      <main className="flex-1 overflow-hidden min-w-0">{children}</main>
    </div>
  );
}
