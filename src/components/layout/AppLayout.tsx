import { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { useAICompletionAlert } from "@/hooks/useAICompletionAlert";
import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  useAICompletionAlert();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TopNav />
      <main className="flex-1 overflow-hidden min-w-0 min-h-0">{children}</main>
      <OnboardingGuide />
    </div>
  );
}
