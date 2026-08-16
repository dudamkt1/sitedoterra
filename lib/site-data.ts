export interface SiteData {
  site_title?: string;
  /** Logo do site (menu superior). mode: "image" usa url; "text" usa logoText. */
  logoMode?: "image" | "text";
  logoUrl?: string;
  logoText?: string;
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
  social?: { whatsapp: boolean; instagram: boolean; youtube: boolean };
}

export const DEFAULT_SITE_DATA: SiteData = {
  name: "Ana",
  surname: "Beatriz",
  fullName: "Ana Beatriz",
  role: "Consultora Wellness Diamond · doTERRA",
  eyebrow: "Consultora Certificada doTERRA",
  badgeTitle: "Certified Wellness",
  badgeSubtitle: "Expert em bem-estar",
  description:
    "Transformo bem-estar em rotina com os melhores óleos essenciais do mundo. Há 7 anos ajudo famílias a descobrirem o poder da natureza para uma vida mais equilibrada e saudável.",
  whatsapp: "5511999999999",
  instagramHandle: "@anabeatriz.doterra",
  stats: {
    years: "7+",
    labelYears: "Anos de experiência",
    clients: "850+",
    labelClients: "Clientes atendidas",
    satisfaction: "98%",
    labelSatisfaction: "Satisfação",
  },
  testimonials: [
    {
      text: "Depois de 3 semanas usando o protocolo de sono da Ana, minha insônia de anos simplesmente desapareceu. É incrível como óleos naturais podem fazer diferença tão grande.",
      name: "Mariana Ferreira",
      location: "São Paulo, SP",
      initials: "MF",
    },
    {
      text: "A Ana é muito mais do que uma consultora — ela é uma verdadeira parceira de bem-estar. Me acompanha há 2 anos e sempre indica o produto certo para cada fase da minha vida.",
      name: "Carla Souza",
      location: "Campinas, SP",
      initials: "CS",
    },
    {
      text: "Meu filho tem 6 anos e desde que passei a usar os óleos doTERRA em casa, reduzimos muito as idas ao pediatra. O On Guard virou nosso aliado número um!",
      name: "Renata Lima",
      location: "Rio de Janeiro, RJ",
      initials: "RL",
    },
  ],
  history: {
    paragraphs: [
      "Tudo começou quando minha filha tinha apenas 2 anos e eu me vi completamente perdida tentando encontrar alternativas naturais para as constantes gripes e alergias dela.",
      "Uma amiga me apresentou aos óleos essenciais doTERRA e aquilo mudou tudo. Em poucos meses, vi transformações que eu nem imaginava serem possíveis — não só na saúde da minha filha, mas em toda a nossa família.",
      "Hoje, 7 anos depois, tenho o privilégio de acompanhar mais de 850 famílias nessa mesma jornada de descoberta. Cada história que ouço me renova a certeza de que estou no lugar certo, fazendo exatamente o que fui chamada para fazer.",
    ],
    signature: "Ana Beatriz ✦",
  },
  products: [
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
  faq: [
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
  video: { label: "Assistir vídeo • 8 min" },
  social: { whatsapp: true, instagram: true, youtube: true },
};