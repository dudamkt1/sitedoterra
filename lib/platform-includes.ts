/**
 * CATÁLOGO DE TUDO O QUE O CONSULTOR RECEBE AO ATIVAR O SITE.
 *
 * Reflete a estrutura real da plataforma (seções da HOME, Central de IA e CRM),
 * exibido na seção "Tenha um site assim hoje mesmo" da HOME, logo abaixo do
 * valor de ativação. Mantenha sincronizado com:
 *   - lib/site-sections.ts   (SECTION_TYPE_LABELS / seções do site)
 *   - supabase/migrations/0021_ai_content_center.sql  (ferramentas de IA)
 *   - components/crm/CrmNav.tsx + supabase/migrations/0022_crm.sql  (módulos do CRM)
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
      "Menu e rodapé personalizados",
      "Apresentação com foto e CTAs (Hero)",
      "Especialista IA doTERRA no site",
      "Depoimentos, história e vídeo",
      "Agendamento de consultas integrado",
      "Dicas, produtos em destaque e FAQ",
    ],
  },
  {
    icon: "🤖",
    title: "Central de IA",
    items: [
      "Gerar títulos e descrições",
      "Posts para redes sociais",
      "Descrição de produtos",
      "Anúncios e ideias de conteúdo",
      "Calendário de conteúdo",
      "Respostas para clientes",
      "Central de prompts e templates prontos",
    ],
  },
  {
    icon: "📇",
    title: "CRM de clientes",
    items: [
      "Clientes com ficha completa e histórico",
      "Programa de fidelidade e níveis",
      "Vendas e catálogo de produtos",
      "Financeiro (entradas e saídas)",
      "Cobranças e vencimentos",
      "Mensagens pelo WhatsApp",
      "Tarefas, lembretes e automações",
      "Relatórios com exportação em PDF/CSV",
    ],
  },
  {
    icon: "⚙️",
    title: "Plataforma e suporte",
    items: [
      "Seu endereço personalizado (subdomínio ou domínio próprio)",
      "Painel exclusivo com tudo em um só lugar",
      "Site 100% responsivo",
      "Biblioteca de mídia com armazenamento",
      "Atualizações e novidades em primeira mão",
      "Suporte por WhatsApp",
      "Sem fidelidade — cancele quando quiser",
    ],
  },
];