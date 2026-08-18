import type { SectionPermissions, SectionType, SiteSection } from "@/types";

/**
 * Registro de seções da HOME.
 * Define, em código, o conteúdo padrão de cada tipo de seção, os rótulos
 * usados nos editores e o âncora (id) usado na navegação.
 *
 * O conteúdo padrão aqui NÃO é o que aparece no site quando o banco existe:
 * ele é usado como FALLBACK quando o Supabase não está disponível (ex.: dev
 * local sem env vars) e como base de comparação nas telas de edição.
 * Em produção, a fonte de verdade é a tabela `site_sections` + `tenant_sections`.
 */

export const SECTION_TYPES: SectionType[] = [
  "header",
  "hero",
  "trustbar",
  "about",
  "testimonials",
  "story",
  "video",
  "booking",
  "tips",
  "products",
  "faq",
  "pricing",
  "footer",
];

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  header: "Cabeçalho / Menu",
  hero: "Hero principal",
  trustbar: "Barra de destaque",
  about: "Especialista / Apresentação",
  testimonials: "Depoimentos",
  story: "História / Sobre",
  video: "Vídeo / Conteúdo",
  booking: "Agendamento",
  tips: "Dicas / Rotinas",
  products: "Produtos em destaque",
  faq: "Perguntas frequentes",
  pricing: "Planos / Oferta",
  footer: "Rodapé",
};

export const SECTION_TYPE_ICONS: Record<SectionType, string> = {
  header: "☰",
  hero: "🖼️",
  trustbar: "⭐",
  about: "🤖",
  testimonials: "💬",
  story: "📖",
  video: "🎬",
  booking: "📅",
  tips: "💡",
  products: "🛍️",
  faq: "❓",
  pricing: "💰",
  footer: "🦶",
};

export function anchorFor(type: SectionType): string {
  const map: Record<SectionType, string> = {
    header: "topo",
    hero: "hero",
    trustbar: "destaque",
    about: "about",
    testimonials: "depoimentos",
    story: "historia",
    video: "video",
    booking: "agendamento",
    tips: "dicas",
    products: "produtos",
    faq: "faq",
    pricing: "planos",
    footer: "rodape",
  };
  return map[type] || type;
}

const DEFAULT_PERMISSIONS: SectionPermissions = {
  can_edit: true,
  can_toggle: true,
  can_edit_image: true,
  can_edit_video: true,
  can_edit_button: true,
  can_edit_colors: true,
  can_edit_layout: true,
  available_to_all: true,
};

/**
 * Conteúdo padrão de cada seção (usado como fallback sem banco e como
 * referência visual "padrão da plataforma").
 */
export const DEFAULT_SECTION_CONTENT: Record<SectionType, Record<string, unknown>> = {
  header: { logoText: "Ana Beatriz" },
  hero: {
    eyebrow: "Consultora Certificada doTERRA",
    firstName: "Ana",
    lastName: "Beatriz",
    role: "Consultora Wellness Diamond · doTERRA",
    description:
      "Transformo bem-estar em rotina com os melhores óleos essenciais do mundo. Há 7 anos ajudo famílias a descobrirem o poder da natureza para uma vida mais equilibrada e saudável.",
    image: null,
    imageAlt: "Foto da Consultora",
    badgeTitle: "Certified Wellness",
    badgeSubtitle: "Expert em bem-estar",
    primaryBtn: { text: "Falar com a IA", url: "#about" },
    secondaryBtn: { text: "Ver Produtos", url: "#products" },
    stats: [
      { value: "7+", label: "Anos de experiência" },
      { value: "850+", label: "Clientes atendidas" },
      { value: "98%", label: "Satisfação" },
    ],
  },
  trustbar: {
    badge: "✨",
    title: "Você é consultora doTERRA? Tenha um site profissional como este!",
    subtitle: "Ferramenta completa com IA, agendamento, CRM e muito mais",
    buttonText: "Quero um site assim",
    buttonUrl: "#planos",
  },
  about: {
    eyebrow: "Tecnologia + Natureza",
    title: "Especialista IA doTERRA",
    subtitle:
      "Descreva como você está se sentindo — física ou emocionalmente — e nossa inteligência artificial vai indicar os melhores óleos essenciais para o seu momento.",
    chips: [
      { emoji: "😴", label: "Ansiedade e sono" },
      { emoji: "🤕", label: "Dor de cabeça" },
      { emoji: "🛡️", label: "Imunidade" },
      { emoji: "⚡", label: "Energia e foco" },
      { emoji: "🤢", label: "Digestão" },
      { emoji: "💪", label: "Dores musculares" },
    ],
    chat: {
      name: "Especialista IA doTERRA",
      status: "Online agora",
      welcome:
        "Olá! Sou a assistente especialista em óleos essenciais doTERRA 🌿 Me conte como você está se sentindo hoje — fisicamente ou emocionalmente — e vou indicar os melhores óleos para o seu momento!",
      placeholder: "Como você está se sentindo?",
    },
  },
  testimonials: {
    eyebrow: "O que dizem por aí",
    title: "Histórias que me inspiram todo dia",
    subtitle: "Cada depoimento é uma vida transformada pela natureza.",
    items: [
      {
        text: "Depois de 3 semanas usando o protocolo de sono, minha insônia de anos simplesmente desapareceu. É incrível como óleos naturais podem fazer diferença tão grande.",
        name: "Mariana Ferreira",
        location: "São Paulo, SP",
        initials: "MF",
      },
      {
        text: "Uma verdadeira parceira de bem-estar. Me acompanha há 2 anos e sempre indica o produto certo para cada fase da minha vida.",
        name: "Carla Souza",
        location: "Campinas, SP",
        initials: "CS",
      },
      {
        text: "Meu filho tem 6 anos e desde que passei a usar os óleos em casa, reduzimos muito as idas ao pediatra. Virou nosso aliado número um!",
        name: "Renata Lima",
        location: "Rio de Janeiro, RJ",
        initials: "RL",
      },
    ],
  },
  story: {
    eyebrow: "Minha jornada",
    title: "Uma história de cura e propósito",
    paragraphs: [
      "Tudo começou quando minha filha tinha apenas 2 anos e eu me vi completamente perdida tentando encontrar alternativas naturais para as constantes gripes e alergias dela.",
      "Uma amiga me apresentou aos óleos essenciais e aquilo mudou tudo. Em poucos meses, vi transformações que eu nem imaginava serem possíveis — não só na saúde da minha filha, mas em toda a nossa família.",
      "Hoje, 7 anos depois, tenho o privilégio de acompanhar mais de 850 famílias nessa mesma jornada de descoberta. Cada história que ouço me renova a certeza de que estou no lugar certo.",
    ],
    signature: "Ana Beatriz ✦",
    image: null,
    imageAlt: "Foto da Consultora",
    badgeValue: "7+",
    badgeLabel: "transformando vidas",
  },
  video: {
    eyebrow: "Assista agora",
    title: "O que são óleos essenciais puros?",
    subtitle:
      "Neste vídeo explico de forma simples como os óleos funcionam, por que a pureza faz toda a diferença e como começar sua jornada com segurança.",
    videoUrl: null,
    thumbLabel: "Assistir vídeo • 8 min",
    playLabel: "Reproduzir vídeo",
  },
  booking: {
    eyebrow: "Agenda da consultora",
    title: "Agende sua consulta gratuita",
    subtitle: "Escolha o melhor dia e horário. Após a seleção, você será direcionada ao WhatsApp para confirmar.",
    schedule: {
      monthLabel: "Abril 2026",
      year: 2026,
      firstWeekday: 3,
      daysInMonth: 30,
      available: [3, 7, 8, 10, 14, 15, 17, 21, 22, 24],
      occupied: [2, 5, 9, 12, 16, 19, 23],
      today: 3,
      slots: ["09:00", "09:30", "10:00", "10:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
      taken: { "7": ["09:00", "14:00"], "10": ["10:00", "15:00"], "14": ["09:30", "16:00"], "17": ["14:30"] },
    },
  },
  tips: {
    eyebrow: "Acompanhe no Instagram",
    title: "Dicas, rotinas e momentos reais",
    instagramHandle: "@anabeatriz.doterra",
    instagramUrl: null,
    items: [
      { emoji: "🌿", gradient: "linear-gradient(135deg, #d4e8d4 0%, #a8d5b5 100%)" },
      { emoji: "🍋", gradient: "linear-gradient(135deg, #f5e6d0 0%, #e8c87a 100%)" },
      { emoji: "🌸", gradient: "linear-gradient(135deg, #c8e6d4 0%, #1D5C3A 100%)" },
      { emoji: "🧴", gradient: "linear-gradient(135deg, #fbe8d0 0%, #C4963A 100%)" },
      { emoji: "🌱", gradient: "linear-gradient(135deg, #e0f2e8 0%, #4A9E6B 100%)" },
    ],
  },
  products: {
    eyebrow: "Favoritos da Ana",
    title: "Produtos em destaque",
    storeUrl: null,
    items: [
      {
        name: "On Guard®",
        category: "Proteção imunológica",
        description: "Blend protetor com sabor de canela, cravo, laranja-selvagem e eucalipto. Fortalece o sistema imunológico naturalmente.",
        price: "R$ 189,00",
        emoji: "🌿",
        badge: "Mais vendido",
        gradient: "linear-gradient(135deg, #e8f5ee 0%, #c8e8d8 100%)",
      },
      {
        name: "Lavender",
        category: "Relaxamento & sono",
        description: "O óleo mais versátil do mundo. Calma, relaxa, auxilia o sono e tem propriedades calmantes naturais incomparáveis.",
        price: "R$ 149,00",
        emoji: "💜",
        badge: "Bestseller",
        gradient: "linear-gradient(135deg, #f0f4fe 0%, #c8d8f8 100%)",
      },
      {
        name: "Lemon",
        category: "Energia & clareza",
        description: "Fresco e revitalizante, o limão doTERRA limpa, energiza e eleva o ânimo. Perfeito para aromatizar e purificar ambientes.",
        price: "R$ 89,00",
        emoji: "🍋",
        gradient: "linear-gradient(135deg, #fff8e8 0%, #fce8b0 100%)",
      },
    ],
  },
  faq: {
    eyebrow: "Tiro suas dúvidas",
    title: "Perguntas frequentes",
    subtitle: "Não encontrou sua dúvida? Fale diretamente com a IA ou pelo WhatsApp.",
    items: [
      {
        q: "Os óleos doTERRA são seguros para usar com crianças?",
        a: "Sim! Os óleos doTERRA são certificados CPTG® (Grau de Pureza Terapêutica Certificado), o que significa que não contêm aditivos, pesticidas ou substâncias prejudiciais. Para crianças, recomendo sempre diluir mais (1-2 gotas para 10ml de óleo vegetal) e consultar os guias específicos por faixa etária.",
      },
      {
        q: "Como começo? Qual kit indicar para iniciantes?",
        a: "O melhor ponto de entrada é o Kit Básico Familiar, que inclui os 10 óleos mais usados e versáteis. Mas dependendo do seu objetivo (saúde, sono, energia, proteção), posso indicar o kit ideal. Nossa consulta gratuita existe exatamente para isso — agende e conversamos!",
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
  },
  pricing: {
    eyebrow: "Seja uma TopConsultora",
    title: "Tenha um site assim hoje mesmo",
    subtitle: "Seu negócio merece uma presença profissional na internet.",
    offer: {
      name: "Site Profissional",
      description: "Site profissional com IA, agendamento, CRM, endereço personalizado e suporte.",
      activationRegularCents: 150000,
      activationPriceCents: 29700,
      monthlyPriceCents: 4700,
      savingsCents: 120300,
      promoText: "Oferta especial de lançamento",
      ctaText: "Quero meu site por R$ 297",
      transparencyText:
        "R$ 297 corresponde à ativação inicial do site. Após 3 meses, inicia-se a mensalidade de R$ 47. Sem fidelidade e com cancelamento quando quiser.",
      cancelText: "Sem fidelidade. Cancele quando quiser.",
      allowCancel: true,
      trialDays: 90,
      trialMonths: 3,
      billingInterval: "month",
      benefits: [
        "Site profissional completo",
        "Seu endereço personalizado",
        "Painel exclusivo",
        "Personalização do conteúdo",
        "Site 100% responsivo",
        "Central de IA (conteúdo e redes sociais)",
        "CRM de clientes completo",
        "Agendamento de consultas",
        "Relatórios com exportação PDF/CSV",
        "Suporte por WhatsApp",
      ],
      ctaUrl: "/cadastro",
    },
  },
  footer: {
    aboutText: "Consultora doTERRA Diamond ajudando famílias a descobrirem o poder dos óleos essenciais puros.",
    social: {
      whatsapp: true,
      instagram: { enabled: true, url: null },
      facebook: { enabled: true, url: null },
      youtube: { enabled: true, url: null },
    },
    showPlatformCredit: true,
  },
};

function makeFallbackSection(type: SectionType, sort: number, required = true): SiteSection {
  const label = SECTION_TYPE_LABELS[type];
  const navLabel = ["about", "testimonials", "story", "booking", "products", "faq"].includes(type)
    ? label
    : undefined;
  return {
    id: `fallback-${type}`,
    type,
    key: type,
    label,
    title: null,
    subtitle: null,
    enabled: true,
    is_required: required,
    sort_order: sort,
    settings: {
      showInNav: navLabel ? true : false,
      ...(navLabel ? { navLabel: label.replace("Especialista / Apresentação", "Especialista IA").replace("Produtos em destaque", "Produtos").replace("Perguntas frequentes", "Dúvidas") } : {}),
    },
    content: DEFAULT_SECTION_CONTENT[type],
    permissions: DEFAULT_PERMISSIONS,
  };
}

/**
 * Lista estática de fallback usada quando o banco não está disponível
 * (ex.: build local sem env do Supabase). Ordem espelha o seed do banco.
 */
export const DEFAULT_SECTIONS: SiteSection[] = [
  makeFallbackSection("header", 10),
  makeFallbackSection("hero", 20),
  makeFallbackSection("trustbar", 30, false),
  makeFallbackSection("about", 40),
  makeFallbackSection("testimonials", 50),
  makeFallbackSection("story", 60),
  makeFallbackSection("video", 70),
  makeFallbackSection("booking", 80),
  makeFallbackSection("tips", 90),
  makeFallbackSection("products", 100),
  makeFallbackSection("faq", 110),
  makeFallbackSection("pricing", 120, false),
  makeFallbackSection("footer", 130),
];

export function normalizeSectionPermissions(permissions: SectionPermissions | Record<string, unknown> | null | undefined): SectionPermissions {
  const p = (permissions || {}) as Record<string, unknown>;
  return {
    can_edit: p.can_edit !== false,
    can_toggle: p.can_toggle !== false,
    can_edit_image: p.can_edit_image !== false,
    can_edit_video: p.can_edit_video !== false,
    can_edit_button: p.can_edit_button !== false,
    can_edit_colors: p.can_edit_colors !== false,
    can_edit_layout: p.can_edit_layout !== false,
    available_to_all: p.available_to_all !== false,
  };
}
