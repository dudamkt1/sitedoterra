// Dados de CRM/domínios/mídia/IA da DEMONSTRAÇÃO.
// Salvos exclusivamente no localStorage do dispositivo (nunca no servidor).
// Formatos espelham os tipos reais usados pelas APIs de /api/crm/*.

export const DEMO_CRM_KEY = "sitedoterra_demo_crm_v1";

export interface DemoCrmClient {
  id: string;
  name: string;
  cpf: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  category: string;
  is_vip: boolean;
  first_contact_at: string | null;
  first_purchase_at: string | null;
  last_purchase_at: string | null;
  last_contact_at: string | null;
  created_at: string;
  total_spent_cents: number;
  purchase_count: number;
  points_balance: number;
}

export interface DemoCrmSaleItem {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

export interface DemoCrmSale {
  id: string;
  client_id: string | null;
  sale_date: string;
  status: string;
  payment_method: string | null;
  notes: string | null;
  items: DemoCrmSaleItem[];
  created_at: string;
}

export interface DemoCrmProduct {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
}

export interface DemoCrmCharge {
  id: string;
  client_id: string | null;
  sale_id: string | null;
  amount_cents: number;
  due_date: string;
  payment_method: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface DemoCrmTask {
  id: string;
  title: string;
  client_id: string | null;
  due_date: string;
  due_time: string | null;
  category: string | null;
  notes: string | null;
  priority: string;
  status: string;
  created_at: string;
}

export interface DemoCrmFinancialEntry {
  id: string;
  type: "income" | "expense";
  entry_date: string;
  amount_cents: number;
  category: string;
  description: string | null;
  client_id: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

export interface DemoCrmNote {
  id: string;
  client_id: string;
  note: string;
  created_at: string;
}

export interface DemoCrmTimelineEvent {
  id: string;
  client_id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_at: string;
  created_at: string;
}

export interface DemoCrmPoint {
  id: string;
  client_id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export interface DemoCrmMessageTemplate {
  id: string;
  code: string;
  label: string;
  message: string;
}

export interface DemoCrmAutomation {
  id: string;
  type: string;
  enabled: boolean;
  days: number;
  schedule_time: string | null;
  message: string | null;
}

export interface DemoCrmLoyaltySettings {
  enabled: boolean;
  program_name: string;
  points_per_purchase_cents: number;
  points_per_referral: number;
  points_per_birthday: number;
  points_per_special: number;
  rules: string[];
  benefits: string[];
  rewards: string[];
  levels: { name: string; min_points: number }[];
}

export interface DemoCrmWhatsAppConfig {
  enabled: boolean;
  provider: string;
  api_url: string;
  phone_id: string;
  webhook_url: string;
  has_token: boolean;
  key_hint: string | null;
  connection_status: string;
}

export interface DemoCrmSettings {
  modules: Record<string, boolean>;
  categories: string[];
  financial_categories: { income?: string[]; expense?: string[] };
  vip_rules: { minSpentCents: number; minPurchases: number; minPoints: number; reorderMonths: number };
}

export interface DemoMediaFile {
  id: string;
  public_url: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  category: string;
  status: string;
  created_at: string;
}

export interface DemoDomain {
  id: string;
  domain: string;
  status: string;
  created_at: string;
}

export interface DemoAiHistoryItem {
  id: string;
  tool_code: string | null;
  tool_name?: string | null;
  content: string;
  favorite: boolean;
  created_at: string;
}

export interface DemoAiUserTemplate {
  id: string;
  template_code: string;
  name: string;
  data: Record<string, string>;
  created_at: string;
}

export interface DemoCrmData {
  clients: DemoCrmClient[];
  products: DemoCrmProduct[];
  sales: DemoCrmSale[];
  charges: DemoCrmCharge[];
  tasks: DemoCrmTask[];
  financial: DemoCrmFinancialEntry[];
  notes: DemoCrmNote[];
  timeline: DemoCrmTimelineEvent[];
  points: DemoCrmPoint[];
  messages: DemoCrmMessageTemplate[];
  automations: DemoCrmAutomation[];
  loyalty: DemoCrmLoyaltySettings;
  whatsappConfig: DemoCrmWhatsAppConfig;
  settings: DemoCrmSettings;
  media: DemoMediaFile[];
  domains: DemoDomain[];
  aiHistory: DemoAiHistoryItem[];
  aiFavorites: string[];
  aiUserTemplates: DemoAiUserTemplate[];
  knowledge: { keywords: string; text: string; oils: string[] }[];
}

const nowIso = () => new Date().toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const monthsAgoDate = (n: number) => new Date(Date.now() - n * 30 * 86400000).toISOString().slice(0, 10);

export function buildDemoCrmSeed(): DemoCrmData {
  const clients: DemoCrmClient[] = [
    mkClient("cli_1", "Maria Silva", "maria.silva@exemplo.com", "11987654321", "São Paulo", "SP", "Cliente VIP", true, "1990-03-15", 14, 386400),
    mkClient("cli_2", "Ana Oliveira", "ana.oliveira@exemplo.com", "21998871122", "Rio de Janeiro", "RJ", "Cliente ativo", false, "1985-07-22", 4, 89200),
    mkClient("cli_3", "Juliana Santos", "juliana.santos@exemplo.com", "31977665544", "Belo Horizonte", "MG", "Cliente recorrente", true, "1992-11-08", 9, 271600),
    mkClient("cli_4", "Carla Mendes", "carla.mendes@exemplo.com", "41966554433", "Curitiba", "PR", "Novo cliente", false, "1996-01-30", 1, 24800),
    mkClient("cli_5", "Fernanda Costa", "fernanda.costa@exemplo.com", "61955443322", "Brasília", "DF", "Cliente recorrente", true, "1988-05-12", 7, 194300),
    mkClient("cli_6", "Patrícia Rocha", "patricia.rocha@exemplo.com", "51944332211", "Porto Alegre", "RS", "Lead", false, null, 0, 0),
    mkClient("cli_7", "Beatriz Almeida", "beatriz.almeida@exemplo.com", "85933221100", "Fortaleza", "CE", "Cliente ativo", false, "1994-09-03", 3, 67400),
    mkClient("cli_8", "Renata Lima", "renata.lima@exemplo.com", "71822110099", "Salvador", "BA", "Cliente inativo", false, "1983-12-19", 5, 121500),
  ];

  const products: DemoCrmProduct[] = [
    mkProd("prod_1", "Lavanda 15ml", "Lavandula angustifolia — calmante e relaxante.", 14900, "Óleos Essenciais"),
    mkProd("prod_2", "Lemon 15ml", "Citrus limon — eleva a disposição e o humor.", 8900, "Óleos Essenciais Cítricos"),
    mkProd("prod_3", "On Guard 15ml", "Blend protetor com canela, cravo e laranja-selvagem.", 18900, "Blends Protetores"),
    mkProd("prod_4", "Deep Relief 5ml", "Alívio profundo com mentol e copaíba.", 19800, "Blends Tópicos"),
    mkProd("prod_5", "Breathe 15ml", "Apoia sensação de vias aéreas livres.", 19800, "Blends Respiratórios"),
    mkProd("prod_6", "Frankincense 15ml", "Boswellia — considerado o rei dos óleos.", 34800, "Óleos Essenciais Premium"),
  ];

  const sales: DemoCrmSale[] = [
    mkSale("sale_1", "cli_1", monthsAgoDate(0), "Pago", "Pix", [
      { product_id: "prod_1", product_name: "Lavanda 15ml", quantity: 1, unit_price_cents: 14900, total_cents: 14900 },
      { product_id: "prod_2", product_name: "Lemon 15ml", quantity: 2, unit_price_cents: 8900, total_cents: 17800 },
    ]),
    mkSale("sale_2", "cli_3", monthsAgoDate(0), "Pago", "Cartão de crédito", [
      { product_id: "prod_3", product_name: "On Guard 15ml", quantity: 2, unit_price_cents: 18900, total_cents: 37800 },
      { product_id: "prod_5", product_name: "Breathe 15ml", quantity: 1, unit_price_cents: 19800, total_cents: 19800 },
    ]),
    mkSale("sale_3", "cli_2", monthsAgoDate(0), "Pendente", "Boleto", [
      { product_id: "prod_3", product_name: "On Guard 15ml", quantity: 1, unit_price_cents: 18900, total_cents: 18900 },
    ]),
    mkSale("sale_4", "cli_5", monthsAgoDate(1), "Pago", "Pix", [
      { product_id: "prod_6", product_name: "Frankincense 15ml", quantity: 1, unit_price_cents: 34800, total_cents: 34800 },
      { product_id: "prod_4", product_name: "Deep Relief 5ml", quantity: 1, unit_price_cents: 19800, total_cents: 19800 },
    ]),
    mkSale("sale_5", "cli_1", monthsAgoDate(1), "Pago", "Cartão de crédito", [
      { product_id: "prod_1", product_name: "Lavanda 15ml", quantity: 3, unit_price_cents: 14900, total_cents: 44700 },
    ]),
    mkSale("sale_6", "cli_7", monthsAgoDate(2), "Pago", "Pix", [
      { product_id: "prod_2", product_name: "Lemon 15ml", quantity: 2, unit_price_cents: 8900, total_cents: 17800 },
      { product_id: "prod_1", product_name: "Lavanda 15ml", quantity: 1, unit_price_cents: 14900, total_cents: 14900 },
    ]),
    mkSale("sale_7", "cli_8", monthsAgoDate(3), "Cancelado", "Cartão de crédito", [
      { product_id: "prod_4", product_name: "Deep Relief 5ml", quantity: 2, unit_price_cents: 19800, total_cents: 39600 },
    ]),
    mkSale("sale_8", "cli_3", daysFromNow(-40), "Reembolsado", "Cartão de crédito", [
      { product_id: "prod_5", product_name: "Breathe 15ml", quantity: 1, unit_price_cents: 19800, total_cents: 19800 },
    ]),
  ];

  const charges: DemoCrmCharge[] = [
    mkCharge("chg_1", "cli_1", daysFromNow(-20), 37200, "Pago"),
    mkCharge("chg_2", "cli_2", daysFromNow(3), 18900, "Pendente"),
    mkCharge("chg_3", "cli_4", daysFromNow(-5), 24800, "Vencido"),
    mkCharge("chg_4", "cli_5", daysFromNow(10), 54600, "Pendente"),
    mkCharge("chg_5", "cli_3", daysFromNow(-2), 57600, "Pago"),
  ];

  const tasks: DemoCrmTask[] = [
    mkTask("task_1", "Follow-up sobre Lavanda", "cli_4", daysFromNow(1), "10:00", "Alta", "A fazer"),
    mkTask("task_2", "Enviar sugestão de blend para foco", "cli_2", daysFromNow(2), "14:00", "Urgente", "Em andamento"),
    mkTask("task_3", "Confirmar recebimento do pedido mensal", "cli_1", daysFromNow(-1), "09:00", "Baixa", "Concluída"),
    mkTask("task_4", "Ligar para aniversariante do mês", "cli_5", daysFromNow(4), "16:00", "Média", "A fazer"),
    mkTask("task_5", "Renovar estoque de On Guard", null, daysFromNow(7), null, "Alta", "A fazer"),
  ];

  const financial: DemoCrmFinancialEntry[] = [
    mkFin("fin_1", "income", monthsAgoDate(0), 51500, "Vendas", "Vendas do mês — óleos essenciais", "cli_1"),
    mkFin("fin_2", "income", monthsAgoDate(0), 57600, "Vendas", "Pedido mensal LRP", "cli_3"),
    mkFin("fin_3", "expense", monthsAgoDate(0), 128000, "Estoque", "Reposição de estoque", null),
    mkFin("fin_4", "income", monthsAgoDate(1), 54600, "Vendas", "Combo Premium", "cli_5"),
    mkFin("fin_5", "expense", monthsAgoDate(1), 22000, "Marketing", "Material gráfico — flyers", null),
    mkFin("fin_6", "expense", monthsAgoDate(2), 4500, "Ferramentas", "Assinatura de ferramenta de design", null),
  ];

  const loyalty: DemoCrmLoyaltySettings = {
    enabled: true,
    program_name: "Clube Bem-Estar",
    points_per_purchase_cents: 100,
    points_per_referral: 50,
    points_per_birthday: 30,
    points_per_special: 20,
    rules: [
      "Acumule pontos a cada compra realizada",
      "Ganhe pontos ao indicar amigas",
      "Pontos bônus no seu aniversário",
    ],
    benefits: ["Descontos exclusivos", "Brindes surpresa", "Prioridade em lançamentos"],
    rewards: ["Óleo gratuito a cada 500 pontos", "Kit exclusivo a cada 1000 pontos"],
    levels: [
      { name: "Bronze", min_points: 0 },
      { name: "Prata", min_points: 300 },
      { name: "Ouro", min_points: 700 },
      { name: "Diamante", min_points: 1500 },
    ],
  };

  const points: DemoCrmData["points"] = [
    { id: "pt_1", client_id: "cli_1", amount: 380, type: "compra", description: "Pontos das compras", created_at: monthsAgoDate(1) },
    { id: "pt_2", client_id: "cli_3", amount: 270, type: "compra", description: "Pontos das compras", created_at: monthsAgoDate(1) },
    { id: "pt_3", client_id: "cli_5", amount: 190, type: "indicacao", description: "Indicação de amiga", created_at: monthsAgoDate(2) },
  ];

  return {
    clients,
    products,
    sales,
    charges,
    tasks,
    financial,
    loyalty,
    notes: [],
    timeline: [],
    points,
    messages: [],
    automations: [
      { id: "auto_1", type: "cobranca_antes", enabled: true, days: 3, schedule_time: "09:00", message: "Oi! Passando para lembrar que sua cobrança vence em breve. Qualquer dúvida, me chame! 💚" },
      { id: "auto_2", type: "aniversario", enabled: true, days: 0, schedule_time: "08:00", message: "Feliz aniversário! 🎉 Que seu dia seja abençoado. Tem um mimo especial te esperando!" },
      { id: "auto_3", type: "pos_venda", enabled: false, days: 7, schedule_time: "10:00", message: "Oi! Como está sendo a experiência com seu novo óleo? Estou à disposição! 🌿" },
    ],
    whatsappConfig: {
      enabled: false,
      provider: "meta",
      api_url: "",
      phone_id: "",
      webhook_url: "",
      has_token: false,
      key_hint: null,
      connection_status: "desconectado",
    },
    settings: {
      modules: {
        clientes: true,
        vendas: true,
        produtos: true,
        cobrancas: true,
        tarefas: true,
        whatsapp: true,
        financeiro: true,
        fidelidade: true,
        relatorios: true,
        mensagens: true,
        automacoes: true,
      },
      categories: [
        "Lead",
        "Novo cliente",
        "Cliente ativo",
        "Cliente recorrente",
        "Cliente VIP",
        "Cliente inativo",
        "Cliente perdido",
      ],
      financial_categories: {
        income: ["Vendas", "Serviços", "Outros"],
        expense: ["Estoque", "Marketing", "Ferramentas", "Transporte", "Outros"],
      },
      vip_rules: { minSpentCents: 150000, minPurchases: 5, minPoints: 200, reorderMonths: 3 },
    },
    media: [],
    domains: [{ id: "dom_1", domain: "carla.consultoria.local", status: "active", created_at: monthsAgoDate(2) }],
    aiHistory: [],
    aiFavorites: [],
    aiUserTemplates: [],
    knowledge: [],
  };
}

function mkClient(
  id: string, name: string, email: string, phone: string, city: string, state: string,
  category: string, is_vip: boolean, birth_date: string | null,
  purchase_count: number, total_spent_cents: number
): DemoCrmClient {
  return {
    id,
    name,
    cpf: null,
    birth_date,
    email,
    phone: `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`,
    whatsapp: `55${phone}`,
    city,
    state,
    notes: null,
    category,
    is_vip,
    first_contact_at: monthsAgoDate(Math.min(purchase_count * 2 + 1, 12)),
    first_purchase_at: purchase_count > 0 ? monthsAgoDate(purchase_count + 1) : null,
    last_purchase_at: purchase_count > 0 ? monthsAgoDate(0) : null,
    last_contact_at: monthsAgoDate(1),
    created_at: monthsAgoDate(Math.min(purchase_count * 2 + 2, 14)),
    total_spent_cents,
    purchase_count,
    points_balance: is_vip ? purchase_count * 25 : purchase_count * 10,
  };
}

function mkProd(id: string, name: string, description: string, price_cents: number, category: string): DemoCrmProduct {
  return { id, name, description, price_cents, category, image_url: null, active: true, created_at: monthsAgoDate(6) };
}

function mkSale(id: string, client_id: string | null, sale_date: string, status: string, payment_method: string, items: DemoCrmSaleItem[]): DemoCrmSale {
  return { id, client_id, sale_date, status, payment_method, notes: null, items, created_at: sale_date };
}

function mkCharge(id: string, client_id: string | null, due_date: string, amount_cents: number, status: string): DemoCrmCharge {
  return { id, client_id, sale_id: null, amount_cents, due_date, payment_method: "Pix", notes: null, status, created_at: due_date };
}

function mkTask(id: string, title: string, client_id: string | null, due_date: string, due_time: string | null, priority: string, status: string): DemoCrmTask {
  return { id, title, client_id, due_date, due_time, category: null, notes: null, priority, status, created_at: monthsAgoDate(0) };
}

function mkFin(id: string, type: "income" | "expense", entry_date: string, amount_cents: number, category: string, description: string, client_id: string | null): DemoCrmFinancialEntry {
  return { id, type, entry_date, amount_cents, category, description, client_id, payment_method: "Pix", notes: null, created_at: entry_date };
}

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadDemoCrm(): DemoCrmData {
  if (!isBrowser()) return buildDemoCrmSeed();
  try {
    const raw = localStorage.getItem(DEMO_CRM_KEY);
    if (!raw) {
      const seed = buildDemoCrmSeed();
      localStorage.setItem(DEMO_CRM_KEY, JSON.stringify(seed));
      return seed;
    }
    const saved = JSON.parse(raw) as Partial<DemoCrmData>;
    // Merge com seed garante chaves novas após atualizações do app.
    return { ...buildDemoCrmSeed(), ...saved };
  } catch {
    return buildDemoCrmSeed();
  }
}

export function saveDemoCrm(data: DemoCrmData): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(DEMO_CRM_KEY, JSON.stringify(data));
  } catch {}
}
