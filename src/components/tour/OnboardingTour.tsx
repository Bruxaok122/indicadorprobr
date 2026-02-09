import { useState, useEffect, useCallback, useRef } from "react";
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from "react-joyride";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const TOUR_STORAGE_KEY = "juriszap_tour_completed";

interface TourStep extends Step {
  route?: string;
}

const tourSteps: TourStep[] = [
  // === WELCOME ===
  {
    target: "body",
    content: "Bem-vindo ao JurisZap! 🎉 Vamos fazer um tour rápido para você aprender a usar o sistema. Leva menos de 2 minutos!",
    placement: "center",
    disableBeacon: true,
    route: "/",
  },

  // === DASHBOARD ===
  {
    target: '[data-tour="dashboard-checklist"]',
    content: "Este é o seu checklist de configuração. Siga esses passos na ordem para deixar tudo pronto.",
    route: "/",
  },
  {
    target: '[data-tour="dashboard-stats"]',
    content: "Aqui você acompanha seus números: total de contatos, novos, aguardando resposta e respondidos.",
    route: "/",
  },

  // === CONFIGURAÇÃO ===
  {
    target: "body",
    content: "Agora vamos ver a página de Configuração. É aqui que você conecta sua conta do WhatsApp Business.",
    placement: "center",
    route: "/configuracao",
  },
  {
    target: '[data-tour="config-credentials"]',
    content: "Preencha aqui suas credenciais da API do WhatsApp: Access Token, WABA ID e Phone Number ID. Se o administrador já configurou, você verá uma mensagem de 'Conta Ativa'.",
    route: "/configuracao",
  },
  {
    target: '[data-tour="config-help"]',
    content: "Não sabe onde encontrar as credenciais? Este guia passo-a-passo te ajuda a obter tudo no Meta Developers.",
    route: "/configuracao",
  },

  // === IMPORTAR ===
  {
    target: "body",
    content: "Vamos para a página de Importação de contatos!",
    placement: "center",
    route: "/importar",
  },
  {
    target: '[data-tour="import-tabs"]',
    content: "Você tem duas formas de adicionar contatos: importar uma lista jurídica inteira, ou adicionar um contato individual.",
    route: "/importar",
  },
  {
    target: '[data-tour="import-textarea"]',
    content: "Para importar em massa, cole sua lista jurídica aqui ou carregue um arquivo .txt. O sistema extrai automaticamente nomes, telefones e processos.",
    route: "/importar",
  },

  // === CONTATOS ===
  {
    target: "body",
    content: "Agora vamos ver a página de Contatos!",
    placement: "center",
    route: "/contatos",
  },
  {
    target: '[data-tour="contacts-search"]',
    content: "Use a busca para encontrar contatos por nome, telefone, processo ou advogado.",
    route: "/contatos",
  },
  {
    target: '[data-tour="contacts-table"]',
    content: "Aqui está a lista completa dos seus contatos. Você pode selecionar vários para disparo em massa, enviar templates individualmente ou abrir a conversa.",
    route: "/contatos",
  },

  // === CONVERSAS ===
  {
    target: "body",
    content: "Esta é a página de Conversas — seu chat com os clientes!",
    placement: "center",
    route: "/conversas",
  },
  {
    target: '[data-tour="chat-contact-list"]',
    content: "Na lista à esquerda, você vê todos os contatos com conversas. Clique em um para abrir o chat.",
    route: "/conversas",
  },

  // === TEMPLATES ===
  {
    target: "body",
    content: "Por último, a página de Templates!",
    placement: "center",
    route: "/templates",
  },
  {
    target: '[data-tour="templates-info"]',
    content: "Templates são modelos de mensagem aprovados pela Meta. Para o primeiro contato com um cliente, você PRECISA usar um template.",
    route: "/templates",
  },
  {
    target: '[data-tour="templates-list"]',
    content: "Aqui ficam seus templates aprovados. Clique em 'Disparar para Contatos' para enviar em massa.",
    route: "/templates",
  },

  // === FIM ===
  {
    target: "body",
    content: "Tour completo! 🚀 Resumo: Configure o WhatsApp → Importe contatos → Envie templates. Qualquer dúvida, explore as páginas. Bom trabalho!",
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
  const navigatingRef = useRef(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed && location.pathname === "/") {
      const timer = setTimeout(() => setRun(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // After navigating, wait for DOM to render then advance
  useEffect(() => {
    if (navigatingRef.current && run) {
      const step = tourSteps[stepIndex];
      if (step?.route === location.pathname) {
        navigatingRef.current = false;
      }
    }
  }, [location.pathname, stepIndex, run]);

  const goToStep = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= tourSteps.length) return;

      const nextStep = tourSteps[nextIndex];
      if (nextStep.route && nextStep.route !== location.pathname) {
        navigatingRef.current = true;
        navigate(nextStep.route);
        // Wait for page to render
        setTimeout(() => setStepIndex(nextIndex), 600);
      } else {
        setStepIndex(nextIndex);
      }
    },
    [navigate, location.pathname]
  );

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status, action, index, type } = data;

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        setRun(false);
        setStepIndex(0);
        localStorage.setItem(TOUR_STORAGE_KEY, "true");
        if (location.pathname !== "/") navigate("/");
        return;
      }

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const nextIndex = action === ACTIONS.PREV ? index - 1 : index + 1;
        goToStep(nextIndex);
      }
    },
    [navigate, location.pathname, goToStep]
  );

  if (isMobile) return null;

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
      spotlightPadding={8}
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
