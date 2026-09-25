/**
 * CATÁLOGO DE TUDO O QUE O CONSULTOR RECEBE AO ATIVAR O SITE.
 *
 * Reflete a estrutura real da plataforma (seções da HOME, Central de IA, CRM e
 * painel), exibido na seção "Tudo o que você recebe ao ativar" da HOME, logo
 * abaixo do valor de ativação. Mantenha sincronizado com:
 *   - lib/site-sections.ts             (SECTION_TYPE_LABELS / seções do site)
 *   - lib/ai-tools.ts + lib/demo/ai-catalog.ts (ferramentas da Central de IA)
 *   - components/dashboard/Sidebar.tsx (módulos do painel)
 *   - components/crm/CrmNav.tsx + supabase/migrations/0022_crm.sql (CRM)
 *   - lib/crm-raffle.ts + lib/loyalty-raffle.ts (fidelidade e sorteio)
 */

export interface IncludedGroup {
  icon: string;
  title: string;
  items: string[];
}

export const INCLUDED_CATALOG: IncludedGroup[] = [
  {
    icon: "🌐",
    title: "Site profissional",
    items: [
      "Hero com foto, chamada e botões de ação",
      "Especialista IA doTERRA respondendo no site 24 horas",
      "Depoimentos, história e vídeo",
      "Agendamento de consultas integrado ao site",
      "Dicas, produtos em destaque e FAQ",
      "Sorteio de fidelidade com números e ganhadores",
      "Site 100% responsivo no celular, tablet e computador",
    ],
  },
  {
    icon: "🤖",
    title: "Central de IA",
    items: [
      "Títulos e descrições prontos em segundos",
      "Posts para Instagram, Facebook e WhatsApp",
      "Anúncios e ideias de conteúdo",
      "Calendário de conteúdo de 7, 15 ou 30 dias",
      "Descrições de produtos com foco em venda",
      "FAQ e respostas prontas para clientes",
      "Templates visuais e central de prompts prontos",
      "Especialista IA treinada com as suas respostas",
    ],
  },
  {
    icon: "📇",
    title: "CRM de clientes",
    items: [
      "Ficha de cada cliente com histórico de compras",
      "Vendas, financeiro e cobranças no mesmo lugar",
      "Catálogo de produtos com página pública",
      "Fidelidade por pontos, níveis e benefícios",
      "Sorteio de fidelidade com números e ganhadores",
      "Mensagens pelo WhatsApp com textos prontos",
      "Tarefas, lembretes e automações",
      "Relatórios com exportação em PDF e CSV",
    ],
  },
  {
    icon: "⚙️",
    title: "Plataforma e suporte",
    items: [
      "Seu endereço: subdomínio ou domínio próprio",
      "Aplicativo instalável no celular (PWA)",
      "Biblioteca de mídia com armazenamento",
      "Materiais de apoio e checklist da sua rotina",
      "Painel com tudo organizado em um só lugar",
      "Suporte por WhatsApp",
      "Sem fidelidade — cancele quando quiser",
    ],
  },
];