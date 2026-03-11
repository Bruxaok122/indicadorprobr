export interface OnboardingStep {
  title: string;
  description: string;
  target?: string; // data-onboarding attribute value to highlight
  icon?: string;
}

export interface GuideContent {
  id: string;
  title: string;
  steps: OnboardingStep[];
}

export const guides: Record<string, GuideContent> = {
  conversas: {
    id: "conversas",
    title: "💬 Conversas",
    steps: [
      {
        title: "1. Busque um contato",
        description: "Use esta barra de pesquisa para encontrar um contato pelo nome ou telefone. Digite e os resultados aparecem automaticamente.",
        target: "contact-search",
        icon: "🔍",
      },
      {
        title: "2. Selecione um contato",
        description: "Clique em qualquer contato da lista para abrir a conversa. Os contatos com mensagens recentes aparecem primeiro.",
        target: "contact-list",
        icon: "👆",
      },
      {
        title: "3. Envie uma mensagem",
        description: "Digite sua mensagem aqui embaixo e clique no botão de enviar. Você também pode enviar áudios, imagens e documentos.",
        target: "chat-input",
        icon: "✉️",
      },
      {
        title: "4. Use Templates",
        description: "Clique neste botão para enviar um template pré-aprovado. Templates são necessários para iniciar uma conversa nova.",
        target: "template-button",
        icon: "📄",
      },
      {
        title: "5. Veja o perfil do contato",
        description: "Clique no nome do contato no topo da conversa para abrir a ficha com CPF, processo, dados bancários e mais.",
        target: "chat-header-name",
        icon: "📋",
      },
    ],
  },

  disparos: {
    id: "disparos",
    title: "📡 Disparos",
    steps: [
      {
        title: "1. Cole sua lista de contatos",
        description: "Clique aqui e cole a lista de contatos no formato correto. O sistema processará nomes, telefones e dados automaticamente.",
        target: "dispatch-textarea",
        icon: "📝",
      },
      {
        title: "2. Dê um nome à lista",
        description: "Digite um nome para identificar esta lista de disparo (ex: 'Lista Janeiro 2025').",
        target: "dispatch-list-name",
        icon: "🏷️",
      },
      {
        title: "3. Escolha o número remetente",
        description: "Clique aqui para selecionar qual número de WhatsApp será usado para enviar as mensagens.",
        target: "dispatch-phone-select",
        icon: "📱",
      },
      {
        title: "4. Selecione o template",
        description: "Clique aqui para escolher qual template aprovado será enviado para os contatos da lista.",
        target: "dispatch-template-select",
        icon: "📄",
      },
      {
        title: "5. Inicie o disparo",
        description: "Depois de configurar tudo, clique neste botão para começar a enviar. Acompanhe o progresso em tempo real.",
        target: "dispatch-start-button",
        icon: "🚀",
      },
    ],
  },

  numeros: {
    id: "numeros",
    title: "📱 Números",
    steps: [
      {
        title: "1. Veja seus números",
        description: "Aqui ficam todos os números WhatsApp vinculados à sua conta. Verifique o status de cada um.",
        target: "phone-list",
        icon: "📱",
      },
      {
        title: "2. Registre um número novo",
        description: "Preencha o Phone Number ID e o nome verificado, depois clique em 'Registrar' para vincular um novo número.",
        target: "phone-register-form",
        icon: "➕",
      },
      {
        title: "3. Defina o PIN",
        description: "Clique aqui para configurar o PIN de 6 dígitos obrigatório para a verificação em duas etapas.",
        target: "phone-set-pin",
        icon: "🔐",
      },
      {
        title: "4. Exclua se necessário",
        description: "Clique no ícone de lixeira ao lado de qualquer número na lista para removê-lo permanentemente.",
        target: "phone-list",
        icon: "🗑️",
      },
    ],
  },

  templates: {
    id: "templates",
    title: "📑 Templates",
    steps: [
      {
        title: "1. Veja seus templates",
        description: "Aqui estão listados todos os templates com seu status: Aprovado ✅, Pendente ⏳ ou Rejeitado ❌. Só os aprovados podem ser usados.",
        target: "template-list",
        icon: "👀",
      },
      {
        title: "2. Atualize a lista",
        description: "Clique neste botão para sincronizar os templates com a Meta e ver os mais recentes.",
        target: "template-refresh",
        icon: "🔄",
      },
      {
        title: "3. Crie um novo template",
        description: "Clique aqui para criar e submeter um novo template para aprovação da Meta.",
        target: "template-create",
        icon: "✏️",
      },
    ],
  },

  configuracao: {
    id: "configuracao",
    title: "⚙️ Configuração",
    steps: [
      {
        title: "1. Informe o Access Token",
        description: "Cole aqui o token de acesso da sua conta do Meta Developers. Use o ícone de olho para visualizar.",
        target: "config-token",
        icon: "🔑",
      },
      {
        title: "2. Preencha o WABA ID",
        description: "Informe o ID da sua conta WhatsApp Business (WABA ID), encontrado no painel da Meta.",
        target: "config-waba",
        icon: "🆔",
      },
      {
        title: "3. Valide a configuração",
        description: "Depois de preencher tudo, clique neste botão para verificar se a conexão está funcionando.",
        target: "config-validate",
        icon: "✅",
      },
    ],
  },
};
