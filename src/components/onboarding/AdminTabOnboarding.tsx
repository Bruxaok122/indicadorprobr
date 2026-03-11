import { OnboardingGuide } from "./OnboardingGuide";
import { guides } from "./onboardingContent";

const tabToGuide: Record<string, string> = {
  apis: "",
  saude: "admin_saude",
  usuarios: "admin_usuarios",
  contatos: "admin_contatos",
  disparos: "admin_disparos",
  acompanhamento: "",
  fichas: "admin_fichas",
  "teste-ia": "admin_teste_ia",
  audio: "admin_audio",
};

interface AdminTabOnboardingProps {
  activeTab: string;
}

export function AdminTabOnboarding({ activeTab }: AdminTabOnboardingProps) {
  const guideKey = tabToGuide[activeTab];
  if (!guideKey || !guides[guideKey]) return null;

  return <OnboardingGuide key={guideKey} guide={guides[guideKey]} />;
}
