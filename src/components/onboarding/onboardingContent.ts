export interface OnboardingStep {
  title: string;
  description: string;
  icon?: string; // emoji
}

export interface GuideContent {
  id: string;
  title: string;
  steps: OnboardingStep[];
}

export const guides: Record<string, GuideContent> = {
  conversas: {
    id: "conversas",
    title: "💬 Página de Conversas",
    steps: [
      {
        title: "Lista de Contatos",
        description:
          "No painel esquerdo você encontra todos os seus contatos atribuídos. Use a barra de busca para encontrar um contato pelo nome ou telefone.",
        icon: "👥",
      },
      {
        title: "Enviar Mensagens",
        description:
          "Selecione um contato para abrir a conversa. Digite sua mensagem no campo inferior e clique em Enviar. Você também pode enviar áudios, imagens e documentos.",
        icon: "✉️",
      },
      {
        title: "Enviar Templates",
        description:
          "Use o botão de template (ícone de documento) para enviar mensagens pré-aprovadas pelo WhatsApp. Templates são necessários para iniciar conversas.",
        icon: "📄",
      },
      {
        title: "Perfil do Contato",
        description:
          "Clique no nome do contato no topo da conversa para abrir o painel lateral com informações detalhadas como CPF, processo, status e dados bancários.",
        icon: "📋",
      },
      {
        title: "Contagem Regressiva",
        description:
          "Após o contato responder, você tem uma janela de 24h para enviar mensagens livres. O contador no topo mostra o tempo restante.",
        icon: "⏱️",
      },
    ],
  },

  disparos: {
    id: "disparos",
    title: "📡 Página de Disparos",
    steps: [
      {
        title: "O que são Disparos?",
        description:
          "Disparos permitem enviar mensagens em massa via templates do WhatsApp para uma lista de contatos. É a forma principal de iniciar conversas com novos leads.",
        icon: "🚀",
      },
      {
        title: "Criar Lista de Disparo",
        description:
          "Na aba 'Criar Disparo', cole a lista de contatos no formato adequado (nome e telefone). O sistema processará e validará os números automaticamente.",
        icon: "📝",
      },
      {
        title: "Escolher Template e Número",
        description:
          "Selecione o template aprovado que será enviado e o número de telefone remetente. Certifique-se de que o template está com status 'Aprovado'.",
        icon: "✅",
      },
      {
        title: "Iniciar e Acompanhar",
        description:
          "Após iniciar o disparo, acompanhe o progresso em tempo real na aba 'Acompanhamento'. Você pode pausar, retomar ou cancelar a qualquer momento.",
        icon: "📊",
      },
      {
        title: "Modo Manual vs Automático",
        description:
          "No modo manual, cada envio aguarda sua confirmação. No automático, os envios são feitos com intervalo de segurança. Use o manual para maior controle.",
        icon: "🔄",
      },
    ],
  },

  numeros: {
    id: "numeros",
    title: "📱 Página de Números",
    steps: [
      {
        title: "Seus Números WhatsApp",
        description:
          "Aqui você gerencia os números de telefone vinculados à sua conta. Cada número precisa estar registrado e verificado para enviar mensagens.",
        icon: "📱",
      },
      {
        title: "Registrar Número",
        description:
          "Para registrar um novo número, informe o Phone Number ID fornecido pela Meta e clique em 'Registrar'. O sistema vinculará o número à sua conta.",
        icon: "➕",
      },
      {
        title: "Definir PIN",
        description:
          "O PIN de 6 dígitos é obrigatório para a verificação em duas etapas do WhatsApp Business. Defina ou altere o PIN no card 'Definir PIN'.",
        icon: "🔐",
      },
      {
        title: "Enviar Mensagem de Teste",
        description:
          "Use a seção 'Teste de Envio' para enviar uma mensagem de teste e verificar se o número está funcionando corretamente antes de usar em disparos.",
        icon: "🧪",
      },
      {
        title: "Excluir Número",
        description:
          "Se precisar remover um número, clique no ícone de lixeira ao lado dele. Atenção: esta ação é permanente e o número precisará ser re-registrado.",
        icon: "🗑️",
      },
    ],
  },

  templates: {
    id: "templates",
    title: "📑 Página de Templates",
    steps: [
      {
        title: "O que são Templates?",
        description:
          "Templates são mensagens pré-aprovadas pela Meta/WhatsApp. São obrigatórios para iniciar conversas com contatos que não enviaram mensagem nas últimas 24h.",
        icon: "📄",
      },
      {
        title: "Visualizar Templates",
        description:
          "A lista mostra todos os templates cadastrados com seu status (Aprovado, Pendente ou Rejeitado). Apenas templates aprovados podem ser usados em disparos.",
        icon: "👀",
      },
      {
        title: "Criar Novo Template",
        description:
          "Clique em 'Criar Template' para submeter um novo modelo à Meta. Preencha o nome, categoria e conteúdo. A aprovação pode levar alguns minutos.",
        icon: "✏️",
      },
      {
        title: "Usar em Disparos",
        description:
          "Templates aprovados ficam disponíveis automaticamente na página de Disparos e também podem ser enviados diretamente nas conversas individuais.",
        icon: "📤",
      },
    ],
  },

  configuracao: {
    id: "configuracao",
    title: "⚙️ Página de Configuração",
    steps: [
      {
        title: "Credenciais da API",
        description:
          "Nesta página você configura as credenciais da API do WhatsApp Business: Access Token, WABA ID e Phone Number ID. Esses dados são fornecidos pela Meta.",
        icon: "🔑",
      },
      {
        title: "Validação",
        description:
          "Após salvar as credenciais, clique em 'Validar Configuração' para verificar se a conexão com a API está funcionando corretamente.",
        icon: "✅",
      },
      {
        title: "Segurança",
        description:
          "Suas credenciais são armazenadas de forma segura. Use o ícone de olho para visualizar ou ocultar o Access Token. Nunca compartilhe essas informações.",
        icon: "🔒",
      },
    ],
  },
};
