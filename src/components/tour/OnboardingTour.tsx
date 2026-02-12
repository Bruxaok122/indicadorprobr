import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ArrowRight, Users, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_STORAGE_KEY = "juriszap_tour_completed";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  targetRoute: string;
  targetSelector?: string;
  action?: "navigate" | "highlight";
}

const steps: TourStep[] = [
  {
    title: "Bem-vindo ao JurisZap!",
    description: "Vamos te mostrar como enviar sua primeira mensagem. Clique em 'Próximo' para começar.",
    icon: <MessageSquare className="h-6 w-6" />,
    targetRoute: "/",
  },
  {
    title: "Acesse seus Contatos",
    description: "Primeiro, vá até a página de Contatos para ver seus clientes importados.",
    icon: <Users className="h-6 w-6" />,
    targetRoute: "/contatos",
    action: "navigate",
  },
  {
    title: "Abra uma Conversa",
    description: "Na lista de contatos, clique no ícone de chat (💬) ao lado do contato para abrir a conversa.",
    icon: <MessageSquare className="h-6 w-6" />,
    targetRoute: "/contatos",
  },
  {
    title: "Envie um Template",
    description: "Na conversa, use o botão de Template (📄) para enviar um template aprovado. Essa é a primeira etapa obrigatória pela política da Meta.",
    icon: <Send className="h-6 w-6" />,
    targetRoute: "/conversas",
  },
  {
    title: "Pronto!",
    description: "Após o cliente responder, você pode enviar mensagens de texto e documentos livremente. Bom trabalho!",
    icon: <MessageSquare className="h-6 w-6" />,
    targetRoute: "/conversas",
  },
];

export function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
      setIsVisible(false);
      return;
    }

    const nextStep = steps[currentStep + 1];
    if (nextStep.action === "navigate" && location.pathname !== nextStep.targetRoute) {
      navigate(nextStep.targetRoute);
    }
    setCurrentStep((prev) => prev + 1);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/40"
          />

          {/* Tour card */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 z-[9999] w-[90vw] max-w-md -translate-x-1/2"
          >
            <div className="rounded-2xl border bg-card p-5 shadow-2xl">
              {/* Progress dots */}
              <div className="mb-4 flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= currentStep ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={handleNext} size="sm" className="gap-1.5">
                  {isLastStep ? "Concluir" : "Próximo"}
                  {!isLastStep && <ArrowRight className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
