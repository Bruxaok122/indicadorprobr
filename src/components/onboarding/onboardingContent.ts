export interface OnboardingStep {
  title: string;
  description: string;
  target?: string; // data-onboarding attribute value to highlight
  icon?: string;
  route?: string; // navigate to this route before showing step
}

export const ONBOARDING_ID = "operator-tour-v1";

export const operatorTourSteps: OnboardingStep[] = [
  // === WELCOME ===
  {
    title: "Bem-vindo ao JurisZap! 🎉",
    description: "Vamos fazer um tour rápido para você aprender a usar o sistema. É simples e rápido!",
    icon: "👋",
  },

  // === NAV BAR ===
  {
    title: "Menu de navegação",
    description: "Este é o menu principal. Clique nos botões para trocar entre as páginas do sistema.",
    target: "nav-bar",
    icon: "🧭",
    route: "/conversas",
  },

  // === CONVERSAS ===
  {
    title: "Buscar contatos",
    description: "Use esta barra de pesquisa para encontrar um contato pelo nome ou telefone. Digite e os resultados aparecem automaticamente.",
    target: "contact-search",
    icon: "🔍",
    route: "/conversas",
  },
  {
    title: "Lista de contatos",
    description: "Aqui ficam todos os seus contatos. Clique em qualquer um para abrir a conversa. Os que têm mensagens recentes aparecem primeiro.",
    target: "contact-list",
    icon: "👆",
    route: "/conversas",
  },
  {
    title: "Área de conversa",
    description: "Depois de selecionar um contato, a conversa aparece aqui. Use o campo de texto para digitar e enviar mensagens, áudios, imagens e documentos.",
    target: "chat-input",
    icon: "✉️",
    route: "/conversas",
  },
  {
    title: "Enviar Templates",
    description: "Clique neste ícone para enviar um template pré-aprovado. Templates são obrigatórios para iniciar uma conversa nova com um contato.",
    target: "template-button",
    icon: "📄",
    route: "/conversas",
  },
  {
    title: "Perfil do contato",
    description: "Clique no nome do contato no topo da conversa para ver a ficha completa: CPF, processo, dados bancários e mais informações.",
    target: "chat-header-name",
    icon: "📋",
    route: "/conversas",
  },

  // === DISPAROS (conditional — shown if nav exists) ===
  {
    title: "Página de Disparos",
    description: "Clique aqui no menu para ir à página de Disparos em massa. Lá você pode enviar templates para uma lista inteira de contatos.",
    target: "nav-disparos",
    icon: "📡",
    route: "/conversas",
  },
  {
    title: "Nome da lista",
    description: "Dê um nome para sua lista de contatos, por exemplo: 'Lista Janeiro 2025'. Isso facilita a organização.",
    target: "dispatch-list-name",
    icon: "🏷️",
    route: "/disparos",
  },
  {
    title: "Colar dados dos contatos",
    description: "Cole aqui a lista de contatos no formato correto (NOME, CPF, TELEFONE, etc). O sistema processa tudo automaticamente.",
    target: "dispatch-textarea",
    icon: "📝",
    route: "/disparos",
  },
  {
    title: "Escolher número remetente",
    description: "Selecione qual número de WhatsApp será usado para enviar as mensagens do disparo.",
    target: "dispatch-phone-select",
    icon: "📱",
    route: "/disparos",
  },
  {
    title: "Selecionar template",
    description: "Escolha qual template aprovado será enviado para todos os contatos da lista selecionada.",
    target: "dispatch-template-select",
    icon: "📄",
    route: "/disparos",
  },

  // === TEMPLATES ===
  {
    title: "Página de Templates",
    description: "Clique aqui para ir à página de Templates. Nela você vê todos os templates e seu status de aprovação.",
    target: "nav-templates",
    icon: "📑",
    route: "/disparos",
  },
  {
    title: "Lista de templates",
    description: "Aqui estão todos os seus templates. Veja o status: Aprovado ✅, Pendente ⏳ ou Rejeitado ❌. Só os aprovados podem ser usados para enviar.",
    target: "template-list",
    icon: "👀",
    route: "/templates",
  },
  {
    title: "Atualizar templates",
    description: "Clique neste botão para sincronizar com a Meta e ver os templates mais recentes.",
    target: "template-refresh",
    icon: "🔄",
    route: "/templates",
  },
  {
    title: "Criar novo template",
    description: "Clique aqui para criar e enviar um novo template para aprovação da Meta.",
    target: "template-create",
    icon: "✏️",
    route: "/templates",
  },

  // === NÚMEROS (conditional) ===
  {
    title: "Página de Números",
    description: "Clique aqui para gerenciar seus números WhatsApp. Veja o status, registre novos e configure o PIN.",
    target: "nav-numeros",
    icon: "📱",
    route: "/templates",
  },
  {
    title: "Números cadastrados",
    description: "Aqui ficam todos os números WhatsApp vinculados à sua conta. Verifique o status de conexão de cada um.",
    target: "phone-list",
    icon: "📱",
    route: "/whatsapp-api",
  },
  {
    title: "Registrar número novo",
    description: "Preencha o código do país, número de telefone e nome verificado. Depois clique em 'Registrar' para vincular.",
    target: "phone-register-form",
    icon: "➕",
    route: "/whatsapp-api",
  },
  {
    title: "Definir PIN",
    description: "Configure o PIN de 6 dígitos obrigatório para a verificação em duas etapas do número.",
    target: "phone-set-pin",
    icon: "🔐",
    route: "/whatsapp-api",
  },

  // === FINAL ===
  {
    title: "Tudo pronto! 🚀",
    description: "Você completou o tour! Agora é só começar a usar. Se tiver dúvidas, repita o tour pelo botão de ajuda no menu.",
    icon: "✅",
  },
];
