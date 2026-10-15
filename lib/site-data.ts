export interface SiteData {
  site_title?: string;
  /** Logo do site (menu superior). mode: "image" usa url; "text" usa logoText. */
  logoMode?: "image" | "text";
  logoUrl?: string;
  /** Logo alternativa para quando o menu fica com fundo claro (ao rolar a página). */
  logoLightUrl?: string;
  logoText?: string;
  /** Favicon exibido na aba do navegador. */
  faviconUrl?: string;
  name?: string;
  surname?: string;
  fullName?: string;
  role?: string;
  eyebrow?: string;
  badgeTitle?: string;
  badgeSubtitle?: string;
  description?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  instagramHandle?: string;
  stats?: {
    years?: string;
    labelYears?: string;
    clients?: string;
    labelClients?: string;
    satisfaction?: string;
    labelSatisfaction?: string;
  };
  testimonials?: { text: string; name: string; location: string; initials: string }[];
  history?: { paragraphs: string[]; signature: string };
  products?: {
    name: string;
    category: string;
    description: string;
    price: string;
    emoji: string;
    badge?: string;
    gradient?: string;
  }[];
  faq?: { q: string; a: string }[];
  schedule?: {
    monthLabel: string;
    year: number;
    firstWeekday: number;
    daysInMonth: number;
    available: number[];
    occupied: number[];
    today: number;
    slots: string[];
    taken: Record<string, string[]>;
  };
  video?: { label: string };
  social?: {
    whatsapp?: boolean;
    instagram?: { enabled?: boolean; url?: string };
    facebook?: { enabled?: boolean; url?: string };
    youtube?: { enabled?: boolean; url?: string };
  };
}

export const DEFAULT_SITE_DATA: SiteData = {
  name: "Ana",
  surname: "Beatriz",
  fullName: "Ana Beatriz",
  role: "Consultora doTERRA",
  eyebrow: "Consultora Certificada doTERRA",
  badgeTitle: "Certified Wellness",
  badgeSubtitle: "DEMONSTRAÇÃO — Veja como seu site poderá ficar",
  description:
    "Consultora doTERRA, pare de perder oportunidades no direct!",
  whatsapp: "5511999999999",
  instagram: "anabeatriz.doterra",
  instagramHandle: "@anabeatriz.doterra",
  // Stats removidos — anteriormente eram indicadores fictícios (7+ anos, 850+ clientes, 98% satisfação)
  // que eram apresentados como resultados comprovados do serviço vendido. Agora a página foca
  // na demonstração transparente do serviço para consultoras que desejam contratar seu próprio site.
  stats: undefined,
  testimonials: [
    {
      text: "O site Profissional me ajudou a organizar o atendimento com clientes e facilitei o contato pelo WhatsApp.",
      name: "Exemplo Consultora",
      location: "São Paulo, SP",
      initials: "EC",
    },
    {
      text: "As ferramentas de agenda online facilitam muito o agendamento das minhas consultas, sem precisar dizer 'oi, tudo bem' no direct o tempo todo.",
      name: "Exemplo Consultora",
      location: "Campinas, SP",
      initials: "RC",
    },
    {
      text: "O CRM integrado ajudou a acompanhar o histórico das clientes e oferecer produtos certos na hora certa.",
      name: "Exemplo Consultora",
      location: "Rio de Janeiro, RJ",
      initials: "LC",
    },
  ],
  history: {
    paragraphs: [
      "Tudo começou quando uma consultora descobriu que poderia ter seu próprio site profissional para organizar seu negócio.",
      "Com as ferramentas certas, ficou mais fácil gerenciar atendimentos, agenda e acompanhamento de clientes.",
      "Hoje, consultoras doTERRA têm à disposuna plataforma completa para apresentar produtos, atender clientes 24 horas com IA e facilitar agendamentos pelo celular.",
    ],
    signature: "Consultora doTERRA",
  },
  products: [
    {
      name: "On Guard®",
      category: "Proteção imunológica",
      description: "Blend aromatico com canela, cravo e eucalipto. Ideal para difusão ambiental e cuidados gerais.",
      price: "R$ 189,00",
      emoji: "🌿",
      badge: "Demonstração",
      gradient: "linear-gradient(135deg, #e8f5ee 0%, #c8e8d8 100%)",
    },
    {
      name: "Lavender",
      category: "Relaxamento",
      description: "Óleo versátil amplamente usado para momentos de descanso e bem-estar geral.",
      price: "R$ 149,00",
      emoji: "💜",
      badge: "Demonstração",
      gradient: "linear-gradient(135deg, #f0f4fe 0%, #c8d8f8 100%)",
    },
    {
      name: "Lemon",
      category: "Energia",
      description: "Óleo Citrino refrescante, usado para aromatização e ambientes revitalizados.",
      price: "R$ 89,00",
      emoji: "🍋",
      gradient: "linear-gradient(135deg, #fff8e8 0%, #fce8b0 100%)",
    },
  ],
  faq: [
    {
      q: "Os óleos doTERRA são seguros para usar com crianças?",
      a: "Sim! Os óleos doTERRA são certificados CPTG® (Grau de Pureza Terapêutica Certificado), o que significa que não contêm aditivos, pesticidas ou substâncias prejudiciais. Para crianças, recomendo sempre diluir mais (1-2 gotas para 10ml de óleo vegetal) e consultar os guias específicos por faixa etária.",
    },
    {
      q: "Como começo? Qual kit indicar para iniciantes?",
      a: "O melhor ponto de entrada é o Kit Básico Familiar, que inclui os 10 óleos mais usados e versáteis. Mas dependendo do seu objetivo, posso indicar o kit ideal. Nossa consulta gratuita existe exatamente para isso — agende e conversamos!",
    },
    {
      q: "Posso usar óleos essenciais na gravidez?",
      a: "Alguns óleos são seguros com as devidas precauções, enquanto outros devem ser evitados nos primeiros trimestres. Lavender, Frankincense e Wild Orange são geralmente bem tolerados. Recomendo fortemente uma consulta personalizada para gestantes.",
    },
    {
      q: "Como fazer para comprar? Precisa ser membro?",
      a: "Você pode comprar como cliente a varejo (preço normal) ou se tornar membro Wellness Advocate com 25% de desconto em todas as compras. Não há mensalidade — basta fazer uma compra mínima de pontos por mês ou não fazer nada (sem obrigação!).",
    },
  ],
  schedule: (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const monthLabel = `${MONTHS[month]} ${year}`;
    const weekdays = [1,2,3,4,5];
    const slots = ["09:00", "09:30", "10:00", "10:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"];
    const available: number[] = [];
    for (let d=1; d<=daysInMonth; d++) { if (weekdays.includes(new Date(year, month, d).getDay())) available.push(d); }
    const occupied = available.slice(2,5);
    const availFiltered = available.filter(d => !occupied.includes(d)).slice(0,10);
    return {
      monthLabel,
      year,
      firstWeekday,
      daysInMonth,
      available: availFiltered,
      occupied,
      today: now.getDate(),
      slots,
      taken: {} as Record<string, string[]>,
    };
  })(),
  video: { label: "Assistir vídeo • 8 min" },
  social: {
    whatsapp: true,
    instagram: { enabled: true, url: "https://instagram.com/anabeatriz.doterra" },
    facebook: { enabled: false, url: "" },
    youtube: { enabled: false, url: "" },
  },
};

/**
 * Logo da HOME MODELO (domínio principal e páginas da plataforma).
 *
 * O `/admin/editor-home` (seção global "Cabeçalho/Menu") é a FONTE OFICIAL:
 * os dados do tenant oficial (`site_settings`) valem só como fallback para
 * quando o modelo ainda não tem logo. Sem essa ordem, um logo antigo salvo
 * no tenant oficial sombreava o logo novo do editor e a HOME principal
 * "não atualizava" mesmo com o salvamento correto.
 */
export function resolveModelLogo(
  headerContent: Record<string, unknown>,
  siteData: Record<string, unknown>,
  fallbackLabel?: string
): { mode: "image" | "text"; url?: string; lightUrl?: string; text: string } {
  const str = (v: unknown): string | undefined => {
    const s = typeof v === "string" ? v.trim() : "";
    return s || undefined;
  };
  const url = str(headerContent.logoUrl) || str(siteData.logoUrl);
  return {
    mode: url ? "image" : "text",
    url,
    lightUrl: str(headerContent.logoLightUrl) || str(siteData.logoLightUrl),
    text: str(headerContent.logoText) || str(siteData.logoText) || fallbackLabel || "Logo",
  };
}