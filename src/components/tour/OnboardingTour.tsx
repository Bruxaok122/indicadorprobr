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
    content: "Bem-vindo ao JurisZap! 🎉 Vamos te ensinar passo a passo como adicionar seus contatos e fazer seu primeiro disparo de template. Leva menos de 2 minutos!",
    placement: "center",
    disableBeacon: true,
    route: "/",
  },

  // === DASHBOARD ===
  {
    target: '[data-tour="dashboard-checklist"]',
    content: "Este é o seu checklist. Ele mostra o que você precisa fazer para começar: configurar o WhatsApp, importar contatos e enviar mensagens. Siga na ordem!",
    route: "/",
  },
  {
    target: '[data-tour="dashboard-stats"]',
    content: "Estes cards mostram seus números em tempo real: quantos contatos você tem, quantos são novos, quantos aguardam resposta e quantos já responderam.",
    route: "/",
  },

  // === CONFIGURAÇÃO (breve) ===
  {
    target: '[data-tour="config-credentials"]',
    content: "Primeiro passo: conectar o WhatsApp. Se o administrador já configurou para você, vai aparecer 'Conta Ativa' e você pode pular esta etapa. Caso contrário, preencha suas credenciais aqui.",
    route: "/configuracao",
  },

  // === IMPORTAR — FLUXO DETALHADO ===
  {
    target: "body",
    content: "Agora vamos aprender a adicionar contatos! Existem duas formas: importar uma lista jurídica inteira ou adicionar contatos um a um.",
    placement: "center",
    route: "/importar",
  },
  {
    target: '[data-tour="import-tabs"]',
    content: "Use estas abas para escolher: 'Importar Lista' para adicionar vários contatos de uma vez, ou 'Adicionar Individual' para cadastrar um por um.",
    route: "/importar",
  },
  {
    target: '[data-tour="import-file-upload"]',
    content: "📁 Opção 1: Carregue um arquivo .txt com sua lista jurídica. O sistema lê o arquivo e extrai todos os dados automaticamente.",
    route: "/importar",
  },
  {
    target: '[data-tour="import-textarea"]',
    content: "📋 Opção 2: Cole o texto da sua lista jurídica diretamente aqui. O sistema identifica os emojis (👤 nome, 📞 telefone, ⚖️ advogado) e separa cada contato pelo divisor '===='.",
    route: "/importar",
  },
  {
    target: '[data-tour="import-format-example"]',
    content: "Não sabe o formato? Veja este exemplo! Você pode até clicar em 'Usar Exemplo' para testar com dados fictícios antes de importar seus dados reais.",
    route: "/importar",
  },
  {
    target: '[data-tour="import-process-btn"]',
    content: "Depois de colar ou carregar a lista, clique em 'Processar Lista'. O sistema vai mostrar uma prévia com todos os contatos encontrados para você conferir antes de confirmar.",
    route: "/importar",
  },

  // === CONTATOS — GERENCIAR E DISPARAR ===
  {
    target: "body",
    content: "Após importar, seus contatos aparecem aqui na página de Contatos. Vamos ver como fazer o primeiro disparo!",
    placement: "center",
    route: "/contatos",
  },
  {
    target: '[data-tour="contacts-search"]',
    content: "🔍 Use a busca para encontrar rapidamente qualquer contato por nome, telefone, número do processo ou advogado.",
    route: "/contatos",
  },
  {
    target: '[data-tour="contacts-table"]',
    content: "Esta é a lista dos seus contatos. Cada linha mostra nome, telefone, processo, advogado e status. Use o checkbox à esquerda para selecionar contatos para disparo em massa.",
    route: "/contatos",
  },
  {
    target: '[data-tour="contacts-import-btn"]',
    content: "Precisa adicionar mais contatos? Este botão te leva direto para a importação.",
    route: "/contatos",
  },

  // === TEMPLATES (breve) ===
  {
    target: '[data-tour="templates-info"]',
    content: "⚠️ Regra importante: para o PRIMEIRO contato com um cliente, você precisa usar um template aprovado pela Meta. Depois que ele responder, você pode enviar mensagens livres por 24 horas.",
    route: "/templates",
  },
  {
    target: '[data-tour="templates-list"]',
    content: "Aqui ficam seus templates aprovados. Clique em 'Disparar para Contatos' em qualquer template, selecione os contatos desejados e envie! Simples assim.",
    route: "/templates",
  },

  // === FIM ===
  {
    target: "body",
    content: "Tour completo! 🚀\n\nResumo do fluxo:\n1️⃣ Configure o WhatsApp (ou peça ao admin)\n2️⃣ Importe seus contatos (lista ou individual)\n3️⃣ Vá em Templates e dispare para os contatos\n\nAgora é com você! Boa sorte! 💪",
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
