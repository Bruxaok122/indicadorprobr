import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAICompletionAlert } from "@/hooks/useAICompletionAlert";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  useAICompletionAlert();

  return (
    <div className={`flex min-h-screen bg-background overflow-hidden ${isMobile ? 'flex-col' : ''}`}>
      <Sidebar />
      <main className="flex-1 overflow-hidden min-w-0">{children}</main>
    </div>
  );
}
