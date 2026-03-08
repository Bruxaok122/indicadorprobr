import { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { useAICompletionAlert } from "@/hooks/useAICompletionAlert";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  useAICompletionAlert();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopNav />
      <main className="flex-1 overflow-hidden min-w-0">{children}</main>
    </div>
  );
}
