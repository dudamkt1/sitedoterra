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
  "portfolio",
  "testimonials",
  "story",
  "video",
  "booking",
  "tips",
  "products",
  "loyalty_raffle",
  "faq",
  "pricing",
  "affiliates",
  "footer",
];

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  header: "Cabeçalho / Menu",
  hero: "Hero principal",
  trustbar: "Barra de destaque",
  about: "Especialista / Apresentação",
  portfolio: "Modelos de site",
  testimonials: "Depoimentos",
  story: "História / Sobre",
  video: "Vídeo / Conteúdo",
  booking: "Agendamento",
  tips: "Dicas / Rotinas",
  products: "Produtos em destaque",
  loyalty_raffle: "Sorteio Fidelidade",
  faq: "Perguntas frequentes",
  pricing: "Planos / Oferta",
  affiliates: "Chamada Afiliados",
  footer: "Rodapé",
};

export const SECTION_TYPE_ICONS: Record<SectionType, string> = {
  header: "☰",
  hero: "🖼️",
  trustbar: "⭐",
  about: "🤖",
  portfolio: "🧩",
  testimonials: "💬",
  story: "📖",
  video: "🎬",
  booking: "📅",
  tips: "💡",
  products: "🛍️",
  loyalty_raffle: "🎟️",
  faq: "❓",
  pricing: "💰",
  affiliates: "🤝",
  footer: "🦶",
};

export function anchorFor(type: SectionType): string {
  const map: Record<SectionType, string> = {
    header: "topo",
    hero: "hero",
    trustbar: "destaque",
    about: "about",
    portfolio: "modelos",
    testimonials: "depoimentos",
    story: "historia",
    video: "video",
    booking: "agendamento",
    tips: "dicas",
    products: "produtos",
    loyalty_raffle: "sorteio",
    faq: "faq",
    pricing: "planos",
    affiliates: "afiliados",
    footer: "rodape",
  };
  return map[type] || type;
}

export interface AnchorOption {
  value: string;
  label: string;
}

/**
 * Monta a lista de destinos internos (âncoras) para o seletor de seções dos
 * editores. Só entram seções ativas com âncora válida; "header" e "footer" são
 * ignorados (não possuem id no DOM). Usado pelos campos de destino dos botões
 * (Hero, Barra de destaque, etc.) para o usuário escolher a seção em vez de
 * digitar o link — o clique rola suavemente até ela.
 */
export function buildAnchorOptions(
  sections: Array<{ type: string; anchor?: string; enabled?: boolean; label?: string; navLabel?: string }>,
  opts?: { excludeTypes?: string[] }
): AnchorOption[] {
  const exclude = new Set(opts?.excludeTypes || ["header", "footer"]);
  const seen = new Set<string>();
  const out: AnchorOption[] = [];
  for (const s of sections) {
    if (s.enabled === false) continue;
    if (exclude.has(s.type)) continue;
    const type = s.type as SectionType;
    const anchor = s.anchor || (SECTION_TYPES.includes(type) ? anchorFor(type) : s.type);
    if (!anchor || seen.has(anchor)) continue;
    seen.add(anchor);
    const label = s.navLabel || s.label || SECTION_TYPE_LABELS[type] || s.type;
    out.push({ value: `#${anchor}`, label: `${label} (#${anchor})` });
  }
  return out;
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
  header: { logoText: "Ana Beatriz", logoUrl: "", logoLightUrl: "" },
  hero: {
    eyebrow: "Consultora Certificada doTERRA",
    firstName: "Ana",
    lastName: "Beatriz",
    role: "Consultora doTERRA",
    description:
      "Consultora doTERRA, pare de perder oportunidades no direct!",
    image: null,
    imageAlt: "Foto da Consultora",
    badgeTitle: "Certified Wellness",
    badgeSubtitle: "DEMONSTRAÇÃO — Veja como seu site poderá ficar",
    primaryBtn: { text: "QUERO ATIVAR MEU SITE", url: "/cadastro" },
    secondaryBtn: { text: "Ver Produtos", url: "#produtos" },
    // stats removidos — anteriormente exibíam números fictícios (7+ anos, 850+ clientes, 98% satisfação)
    // como se fossem resultados comprovados do serviço vendido. Substituídos por identificação de demonstração.
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
      "Sua assistente virtual disponível 24 horas para ajudar no atendimento às suas clientes.",
    chips: [
      { emoji: "😴", label: "Sono e descanso" },
      { emoji: "💆", label: "Bem-estar geral" },
      { emoji: "🌿", label: "Conforto diário" },
      { emoji: "⚡", label: "Energia e disposition" },
      { emoji: "🍃", label: "Cuidado com o bem-estar" },
    ],
    chat: {
      name: "Assistente Virtual",
      status: "Disponível",
      welcome:
        "Olá! Sou a assistente virtual doTERRA 🌿 Posso ajudar a apresentar informações sobre nossos produtos e apoiar no atendimento às suas clientes. Me conte mais sobre o que você gostaria de saber!",
      placeholder: "What would you like to know?",
    },
  },
  portfolio: {
    eyebrow: "Modelos de site",
    title: "Escolha seu modelo de site",
    subtitle:
      "Seu site profissional + ferramentas para vender e organizar seu negócio. Escolha o modelo que mais combina com a sua empresa e produtos — depois personalize textos, imagens, cores e seções no seu painel.",
    buttonText: "Ver todos os modelos",
    buttonUrl: "/portfolio",
    maxModels: 6,
    primaryButtonText: "Quero este modelo",
    secondaryButtonText: "Ver modelo",
  },
  testimonials: {
    eyebrow: "O que dizem por aí",
    title: "Histórias ilustrativas",
    subtitle: "Experiências de consultoras que utilizam as ferramentas do site doTERRA",
    items: [
      {
        text: "O site Profissional me ajudou a organizar o atendimento com clientes e facilitei o contato pelo WhatsApp.",
        name: "Exemplo Consultora",
        location: "São Paulo, SP",
        initials: "EC",
      },
      {
        text: "As ferramentas de agenda online facilitaram muito o agendamento das minhas consultas, sem precisaholer 'oi, tudo bem' no direct o tempo todo.",
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
  },
  story: {
    eyebrow: "Minha jornada",
    title: "Uma história de propósito",
    paragraphs: [
      "Tudo começou quando uma consultora decidiu criar seu próprio site para organizar seu negócio.",
      "Com as ferramentas certas, ficou mais fácil gerenciar atendimentos, agenda e acompanhamento de clientes.",
      "Hoje, consultoras doTERRA têm à disposa uma plataforma completa para apresentar produtos, atender clientes com apoio de IA e facilitar agendamentos pelo celular.",
    ],
    signature: "Consultora doTERRA",
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
    subtitle: "Chega de 'oi, tudo bem' no direct — organize o atendimento e facilite o contato com suas clientes.",
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
    eyebrow: "Favoritos da demonstração",
    title: "Produtos em destaque",
    storeUrl: null,
    items: [
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
    title: "ATIVE SEU SITE PROFISSIONAL",
    subtitle: "Tenha um site profissional com produtos, atendimento com inteligência artificial, agenda online e ferramentas para organizar e expandir seu negócio.",
    paymentConditions: {
      gateway: "mercadopago",
      pixDiscountPercent: 5,
      installments: 3,
      installmentsWithoutInterest: true,
      pixCents: 0,
    },
    offer: {
      name: "Site Profissional",
      description: "Site profissional com IA, agendamento, CRM, endereço personalizado e suporte.",
      activationRegularCents: 29700,
      activationPriceCents: 9700,
      monthlyPriceCents: 4700,
      savingsCents: 20000,
      promoText: "Condições especiais",
      ctaText: "ATIVE SEU SITE PROFISSIONAL",
      transparencyText:
        "R$ 97,00 corresponde à ativação inicial do site. Após 1 mes, inicia-se a mensalidade de apenas R$ 47,00. Sem fidelidade e com cancelamento quando quiser.",
      cancelText: "Sem fidelidade. Cancele quando quiser.",
      allowCancel: true,
      trialDays: 0,
      trialMonths: 0,
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
  affiliates: {
    eyebrow: "Ganhe indicando",
    title: "Indique. Seu colega ativa. Você recebe.",
    subtitle: "Transforme sua rede de consultores em renda extra.",
    buttonText: "Saiba como funciona",
    buttonUrl: "/afiliados",
  },
  loyalty_raffle: {
    eyebrow: "Programa de Fidelidade",
    title: "Toda compra te aproxima do prêmio",
    subtitle: "A cada compra você ganha números da sorte e concorre a prêmios exclusivos.",
    buttonText: "Ver números",
  },
};

function makeFallbackSection(type: SectionType, sort: number, required = true): SiteSection {
  const label = SECTION_TYPE_LABELS[type];
  const navLabel = ["about", "testimonials", "story", "booking", "products", "loyalty_raffle", "faq", "portfolio"].includes(type)
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
      ...(navLabel ? { navLabel: label.replace("Especialista / Apresentação", "Especialista IA").replace("Produtos em destaque", "Produtos").replace("Perguntas frequentes", "Dúvidas").replace("Sorteio Fidelidade", "Sorteio") } : {}),
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
  makeFallbackSection("portfolio", 45, false),
  makeFallbackSection("testimonials", 50),
  makeFallbackSection("story", 60),
  makeFallbackSection("video", 70),
  makeFallbackSection("booking", 80),
  makeFallbackSection("tips", 90),
  makeFallbackSection("products", 100),
  makeFallbackSection("loyalty_raffle", 105, false),
  makeFallbackSection("faq", 110),
  makeFallbackSection("pricing", 120, false),
  makeFallbackSection("affiliates", 125, false),
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
