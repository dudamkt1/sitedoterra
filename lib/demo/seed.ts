import type { DemoData } from "./types";
import { DEFAULT_SECTION_CONTENT } from "@/lib/site-sections";

/** Tipos de seção gerenciáveis (exclui header/footer, como no painel real). */
export const DEMO_SECTION_TYPES = [
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
] as const;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// Retratos fotorrealistas usados como padrão da consultora na demonstração.
const DEMO_HERO_IMAGE =
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1000&auto=format&fit=crop";
const DEMO_STORY_IMAGE =
  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=900&auto=format&fit=crop";

function buildSeedSections() {
  const sections = Object.fromEntries(
    DEMO_SECTION_TYPES.map((type) => [
      type,
      { enabled: true, content: clone(DEFAULT_SECTION_CONTENT[type]) },
    ])
  ) as Record<string, { enabled: boolean; content: Record<string, unknown> }>;

  // Imagens de consultora (fotorrealistas) apenas na demonstração — os
  // padrões da plataforma permanecem intactos.
  if (sections.hero?.content) {
    sections.hero.content.image = DEMO_HERO_IMAGE;
    sections.hero.content.imageAlt = "Carla Oliveira — Consultora doTERRA";
  }
  if (sections.story?.content) {
    sections.story.content.image = DEMO_STORY_IMAGE;
    sections.story.content.imageAlt = "Carla atendendo clientes";
  }
  return sections;
}

const now = () => new Date().toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
const daysAhead = (n: number) =>
  new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

export const DEMO_NAMESPACE = "sitedoterra_demo_";

export function buildDemoSeed(): DemoData {
  const clients = [
    {
      id: "cli_maria",
      name: "Maria Silva",
      email: "maria.silva@exemplo.com",
      phone: "(11) 98765-4321",
      city: "São Paulo, SP",
      vip: true,
      loyaltyPoints: 480,
      notes: "Cliente desde 2022. Ama óleos cítricos e blends para foco.",
      createdAt: daysAgo(420),
    },
    {
      id: "cli_ana",
      name: "Ana Oliveira",
      email: "ana.oliveira@exemplo.com",
      phone: "(21) 99887-1122",
      city: "Rio de Janeiro, RJ",
      vip: false,
      loyaltyPoints: 120,
      notes: "Interessada no On Guard e Deep Relief para família.",
      createdAt: daysAgo(180),
    },
    {
      id: "cli_juliana",
      name: "Juliana Santos",
      email: "juliana.santos@exemplo.com",
      phone: "(31) 97766-5544",
      city: "Belo Horizonte, MG",
      vip: true,
      loyaltyPoints: 760,
      notes: "VIP. Participa do programa de fidelidade. Pedidos recorrentes mensais.",
      createdAt: daysAgo(640),
    },
    {
      id: "cli_carla",
      name: "Carla Mendes",
      email: "carla.mendes@exemplo.com",
      phone: "(41) 96655-4433",
      city: "Curitiba, PR",
      vip: false,
      loyaltyPoints: 60,
      notes: "Conheceu pelo Instagram. Em onboarding.",
      createdAt: daysAgo(40),
    },
    {
      id: "cli_fernanda",
      name: "Fernanda Costa",
      email: "fernanda.costa@exemplo.com",
      phone: "(61) 95544-3322",
      city: "Brasília, DF",
      vip: true,
      loyaltyPoints: 320,
      notes: "VIP. Indicou 3 clientes no último trimestre.",
      createdAt: daysAgo(300),
    },
  ];

  const products = [
    {
      id: "prod_lavanda",
      name: "Lavanda 15ml",
      price: 248.0,
      category: "Óleos Essenciais",
      description: "Lavandula angustifolia — calmante e relaxante.",
      stock: 32,
    },
    {
      id: "prod_lemon",
      name: "Lemon 15ml",
      price: 124.0,
      category: "Óleos Essenciais Cítricos",
      description: "Citrus limon — eleva a disposição e o humor.",
      stock: 51,
    },
    {
      id: "prod_onguard",
      name: "On Guard 15ml",
      price: 268.0,
      category: "Blends Protetores",
      description: "Blend protetor com Clove, Lemon, Cinnamon, Eucalyptus e Rosemary.",
      stock: 18,
    },
    {
      id: "prod_deeprelief",
      name: "Deep Relief 5ml",
      price: 198.0,
      category: "Blends Tópicos",
      description: "Alívio profundo com mentol, wintergreen e copaíba.",
      stock: 14,
    },
    {
      id: "prod_breath",
      name: "Breathe 15ml",
      price: 198.0,
      category: "Blends Respiratórios",
      description: "Apoia sensação de vias aéreas livres.",
      stock: 22,
    },
    {
      id: "prod_digestzen",
      name: "DigestZen 15ml",
      price: 218.0,
      category: "Blends Digestivos",
      description: "Auxilia conforto digestivo.",
      stock: 27,
    },
    {
      id: "prod_frankincense",
      name: "Frankincense 15ml",
      price: 348.0,
      category: "Óleos Essenciais Premium",
      description: "Boswellia — considerado o rei dos óleos.",
      stock: 9,
    },
  ];

  const sales: DemoData["sales"] = [
    {
      id: "sale_001",
      clientId: "cli_maria",
      productIds: ["prod_lavanda", "prod_lemon"],
      total: 372.0,
      status: "pago",
      createdAt: daysAgo(35),
    },
    {
      id: "sale_002",
      clientId: "cli_juliana",
      productIds: ["prod_onguard", "prod_breath", "prod_digestzen"],
      total: 684.0,
      status: "pago",
      createdAt: daysAgo(28),
    },
    {
      id: "sale_003",
      clientId: "cli_ana",
      productIds: ["prod_onguard"],
      total: 268.0,
      status: "pendente",
      createdAt: daysAgo(12),
    },
    {
      id: "sale_004",
      clientId: "cli_fernanda",
      productIds: ["prod_frankincense", "prod_deeprelief"],
      total: 546.0,
      status: "pago",
      createdAt: daysAgo(20),
    },
    {
      id: "sale_005",
      clientId: "cli_carla",
      productIds: ["prod_lavanda"],
      total: 248.0,
      status: "pendente",
      createdAt: daysAgo(4),
    },
    {
      id: "sale_006",
      clientId: "cli_maria",
      productIds: ["prod_digestzen", "prod_breath"],
      total: 416.0,
      status: "pago",
      createdAt: daysAgo(7),
    },
  ];

  const charges: DemoData["charges"] = [
    {
      id: "chg_001",
      clientId: "cli_maria",
      description: "Pedido mensal — LRP",
      amount: 372.0,
      dueDate: daysAgo(20),
      status: "pago",
    },
    {
      id: "chg_002",
      clientId: "cli_ana",
      description: "Compra avulsa On Guard",
      amount: 268.0,
      dueDate: daysAhead(3),
      status: "pendente",
    },
    {
      id: "chg_003",
      clientId: "cli_carla",
      description: "Compra avulsa Lavanda",
      amount: 248.0,
      dueDate: daysAhead(7),
      status: "pendente",
    },
    {
      id: "chg_004",
      clientId: "cli_juliana",
      description: "Renovação trimestral",
      amount: 684.0,
      dueDate: daysAgo(5),
      status: "pago",
    },
    {
      id: "chg_005",
      clientId: "cli_fernanda",
      description: "Combo Premium",
      amount: 546.0,
      dueDate: daysAgo(2),
      status: "pago",
    },
  ];

  const tasks: DemoData["tasks"] = [
    {
      id: "task_001",
      title: "Follow-up com Carla (lavanda)",
      clientId: "cli_carla",
      dueDate: daysAhead(1),
      done: false,
      priority: "media",
    },
    {
      id: "task_002",
      title: "Enviar sugestão de blend para foco",
      clientId: "cli_ana",
      dueDate: daysAhead(2),
      done: false,
      priority: "alta",
    },
    {
      id: "task_003",
      title: "Confirmar recebimento LRP mensal",
      clientId: "cli_juliana",
      dueDate: daysAgo(2),
      done: true,
      priority: "baixa",
    },
    {
      id: "task_004",
      title: "Aniversariante do mês — preparar mensagem",
      clientId: "cli_fernanda",
      dueDate: daysAhead(5),
      done: false,
      priority: "baixa",
    },
    {
      id: "task_005",
      title: "Renovar estoque de On Guard",
      clientId: null,
      dueDate: daysAhead(10),
      done: false,
      priority: "alta",
    },
  ];

  const whatsapp: DemoData["whatsapp"] = [
    {
      id: "wpp_001",
      clientId: "cli_ana",
      direction: "in",
      content: "Oi! O On Guard chegou ontem, amei o aroma. Quando abre o próximo pedido?",
      createdAt: daysAgo(3),
    },
    {
      id: "wpp_002",
      clientId: "cli_ana",
      direction: "out",
      content: "Que ótimo! Vou montar uma sugestão de combos para você hoje à tarde.",
      createdAt: daysAgo(3),
    },
    {
      id: "wpp_003",
      clientId: "cli_maria",
      direction: "in",
      content: "Bom dia! Posso pegar o Lavanda com 5% de desconto essa semana?",
      createdAt: daysAgo(1),
    },
  ];

  const finance: DemoData["finance"] = [
    {
      id: "fin_001",
      type: "receita",
      description: "Venda LRP — Maria Silva",
      amount: 372.0,
      date: daysAgo(35),
    },
    {
      id: "fin_002",
      type: "receita",
      description: "Venda trimestral — Juliana Santos",
      amount: 684.0,
      date: daysAgo(28),
    },
    {
      id: "fin_003",
      type: "receita",
      description: "Combo Premium — Fernanda Costa",
      amount: 546.0,
      date: daysAgo(20),
    },
    {
      id: "fin_004",
      type: "receita",
      description: "Venda avulsa — Maria Silva",
      amount: 416.0,
      date: daysAgo(7),
    },
    {
      id: "fin_005",
      type: "despesa",
      description: "Reposição de estoque",
      amount: 1280.0,
      date: daysAgo(15),
    },
    {
      id: "fin_006",
      type: "despesa",
      description: "Material gráfico — flyers",
      amount: 220.0,
      date: daysAgo(8),
    },
  ];

  const media: DemoData["media"] = [];

  return {
    clients,
    products,
    sales,
    charges,
    tasks,
    whatsapp,
    media,
    finance,
    site: {
      site_title: "Carla Oliveira — Consultora doTERRA",
      name: "Carla",
      surname: "Oliveira",
      fullName: "Carla Oliveira",
      role: "Consultora de Bem-Estar doTERRA",
      eyebrow: "Bem-estar natural com óleos essenciais",
      description:
        "Acompanhe sua jornada de saúde com curadoria personalizada, blends exclusivos e suporte próximo para a sua rotina.",
      badgeTitle: "Consultora Premium",
      badgeSubtitle: "há mais de 4 anos com a doTERRA",
      whatsapp: "(11) 99999-0000",
      email: "carla@exemplo.com",
      instagram: "carla.doterra",
      instagramHandle: "@carla.doterra",
      logoMode: "text",
      logoText: "Carla doTERRA",
      logoUrl: "",
      logoLightUrl: "",
      faviconUrl: "",
      primaryColor: "#1D5C3A",
      accentColor: "#C7A661",
      stats: {
        years: "7+",
        clients: "850+",
        satisfaction: "98%",
      },
      social: {
        instagram: { enabled: true, url: "https://instagram.com/carla.doterra" },
        facebook: { enabled: false, url: "" },
        youtube: { enabled: false, url: "" },
      },
    },
    sections: buildSeedSections(),
    crmSettings: {
      modules: {
        clients: true,
        sales: true,
        products: true,
        charges: true,
        tasks: true,
        whatsapp: true,
        finance: true,
        loyalty: true,
        reports: true,
        messages: true,
      },
      loyalty: {
        enabled: true,
        pointsPerCurrency: 1,
        currencyPerPoint: 0.05,
        vipThreshold: 300,
      },
    },
  };
}
