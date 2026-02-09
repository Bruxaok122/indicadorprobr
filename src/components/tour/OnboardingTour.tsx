import { useState, useEffect, useCallback } from "react";
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from "react-joyride";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const TOUR_STORAGE_KEY = "juriszap_tour_completed";

const tourSteps: (Step & { route?: string })[] = [
  {
    target: "body",
    content:
      "Bem-vindo ao JurisZap! 🎉 Vamos fazer um tour rápido pelo sistema para você conhecer as principais funcionalidades.",
    placement: "center",
    disableBeacon: true,
    route: "/",
  },
  {
    target: '[href="/"]',
    content:
      "Este é o Painel de Controle. Aqui você acompanha o status geral dos seus contatos e as próximas etapas.",
    route: "/",
  },
  {
    target: '[href="/configuracao"]',
    content:
      "Na Configuração, você conecta sua conta do WhatsApp Business API para começar a enviar mensagens.",
    route: "/",
  },
  {
    target: '[href="/importar"]',
    content:
      "Use a página Importar para adicionar sua lista jurídica de clientes ao sistema de forma rápida.",
    route: "/",
  },
  {
    target: '[href="/contatos"]',
    content:
      "Em Contatos você visualiza e gerencia todos os seus clientes cadastrados.",
    route: "/",
  },
  {
    target: '[href="/conversas"]',
    content:
      "Na página Conversas, você envia mensagens e templates pelo WhatsApp diretamente para seus clientes.",
    route: "/",
  },
  {
    target: '[href="/templates"]',
    content:
      "Aqui ficam seus Templates — modelos de mensagem aprovados pelo WhatsApp que você usa para iniciar conversas.",
    route: "/",
  },
  {
    target: "body",
    content:
      "Pronto! Agora você conhece o básico do JurisZap. Comece configurando sua API do WhatsApp. Bom trabalho! 🚀",
    placement: "center",
    route: "/",
  },
];

export function OnboardingTour() {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed && location.pathname === "/") {
      const timer = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status, action, index, type } = data;

      if (
        status === STATUS.FINISHED ||
        status === STATUS.SKIPPED
      ) {
        setRun(false);
        localStorage.setItem(TOUR_STORAGE_KEY, "true");
        // Navigate back to dashboard when done
        if (location.pathname !== "/") {
          navigate("/");
        }
        return;
      }

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const nextIndex =
          action === ACTIONS.PREV ? index - 1 : index + 1;

        if (nextIndex >= 0 && nextIndex < tourSteps.length) {
          const nextStep = tourSteps[nextIndex];
          if (nextStep.route && nextStep.route !== location.pathname) {
            navigate(nextStep.route);
            setTimeout(() => setStepIndex(nextIndex), 300);
          } else {
            setStepIndex(nextIndex);
          }
        }
      }
    },
    [navigate, location.pathname]
  );

  if (isMobile) return null; // Tour works best on desktop

  return (
    <Joyride
      steps={tourSteps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      showProgress
      callback={handleCallback}
      disableOverlayClose
      spotlightClicks={false}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: "hsl(var(--primary))",
          textColor: "hsl(var(--foreground))",
          backgroundColor: "hsl(var(--card))",
          arrowColor: "hsl(var(--card))",
        },
        tooltipContainer: {
          textAlign: "left",
        },
        buttonNext: {
          backgroundColor: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
          borderRadius: "6px",
          padding: "8px 16px",
          fontSize: "14px",
        },
        buttonBack: {
          color: "hsl(var(--muted-foreground))",
          marginRight: "8px",
          fontSize: "14px",
        },
        buttonSkip: {
          color: "hsl(var(--muted-foreground))",
          fontSize: "13px",
        },
        tooltip: {
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 20px 60px -12px rgba(0,0,0,0.25)",
        },
        spotlight: {
          borderRadius: "8px",
        },
      }}
      locale={{
        back: "Voltar",
        close: "Fechar",
        last: "Finalizar",
        next: "Próximo",
        skip: "Pular Tour",
      }}
    />
  );
}
