/** Constantes compartilhadas do CRM (seguro para client components). */

export const DEFAULT_CLIENT_CATEGORIES = [
  "Lead",
  "Novo cliente",
  "Cliente ativo",
  "Cliente recorrente",
  "Cliente VIP",
  "Cliente inativo",
  "Cliente perdido",
];

export const SALE_STATUSES = ["Pendente", "Pago", "Parcial", "Cancelado", "Reembolsado"];
export const SALE_STATUS_COLORS: Record<string, string> = {
  Pendente: "badge-yellow",
  Pago: "badge-green",
  Parcial: "badge-blue",
  Cancelado: "badge-gray",
  Reembolsado: "badge-gray",
};

export const CHARGE_STATUSES = ["Pendente", "Pago", "Vencido", "Cancelado"];
export const CHARGE_STATUS_COLORS: Record<string, string> = {
  Pendente: "badge-yellow",
  Pago: "badge-green",
  Vencido: "badge-red",
  Cancelado: "badge-gray",
};

export const TASK_PRIORITIES = ["Baixa", "Média", "Alta", "Urgente"];
export const TASK_PRIORITY_COLORS: Record<string, string> = {
  Baixa: "badge-gray",
  Média: "badge-blue",
  Alta: "badge-yellow",
  Urgente: "badge-red",
};

export const TASK_STATUSES = ["A fazer", "Em andamento", "Concluída"];

export const CLIENT_CATEGORY_COLORS: Record<string, string> = {
  Lead: "badge-blue",
  "Novo cliente": "badge-yellow",
  "Cliente ativo": "badge-green",
  "Cliente recorrente": "badge-green",
  "Cliente VIP": "badge-gold",
  "Cliente inativo": "badge-gray",
  "Cliente perdido": "badge-gray",
};

export const TIMELINE_EVENT_TYPES: Record<string, string> = {
  compra: "🛒 Compra",
  contato: "📞 Contato",
  mensagem: "💬 Mensagem",
  beneficio: "🎁 Benefício",
  anotacao: "📝 Anotação",
  manual: "📌 Evento",
  outros: "✨ Outros",
};

export const TIMELINE_EVENT_ICONS: Record<string, string> = {
  compra: "🛒",
  contato: "📞",
  mensagem: "💬",
  beneficio: "🎁",
  anotacao: "📝",
  manual: "📌",
  outros: "✨",
};

export const AUTOMATION_TYPES: { code: string; label: string; daysHint: string }[] = [
  { code: "cobranca_antes", label: "Lembrar cliente antes do vencimento", daysHint: "Dias antes do vencimento" },
  { code: "cobranca_dia", label: "Avisar no dia do vencimento", daysHint: "Dia exato do vencimento" },
  { code: "cobranca_apos", label: "Avisar após vencimento", daysHint: "Dias depois do vencimento" },
  { code: "cliente_inativo", label: "Lembrar cliente que não compra há X dias", daysHint: "Dias sem compra" },
  { code: "contato", label: "Lembrar consultor de entrar em contato", daysHint: "Dias sem contato" },
  { code: "aniversario", label: "Mensagem de aniversário", daysHint: "Número de dias" },
  { code: "pos_venda", label: "Mensagem pós-venda", daysHint: "Dias após a venda" },
  { code: "acompanhamento", label: "Mensagem de acompanhamento", daysHint: "Dias após a venda" },
  { code: "vip", label: "Mensagem para cliente VIP", daysHint: "Dias" },
];

export const MESSAGE_TEMPLATE_PRESETS: { code: string; label: string; message: string }[] = [
  {
    code: "pos_venda",
    label: "Pós-venda",
    message:
      "Olá {nome}! 😊 Obrigado pela sua compra! Assim que precisar de dicas de uso ou de qualquer ajuda com seus produtos, é só chamar. Beijos! 💚",
  },
  {
    code: "lembrete",
    label: "Lembrete",
    message: "Olá {nome}! Passando para lembrar do combinado. Qualquer dúvida, estou à disposição! 😉",
  },
  {
    code: "aniversario",
    label: "Aniversário",
    message: "🎉 Feliz aniversário, {nome}! Que seu dia seja repleto de alegria, saúde e aromas deliciosos! Conta comigo! 💚",
  },
  {
    code: "inativo",
    label: "Cliente inativo",
    message: "Olá {nome}! Faz um tempinho que não falamos 😊 Tenho novidades e sugestões especiais para você. Vamos conversar?",
  },
  {
    code: "vip",
    label: "Cliente VIP",
    message: "Olá {nome}! Como cliente especial, você tem acesso a benefícios exclusivos 🎁 Vou te mostrar as novidades em primeira mão!",
  },
  {
    code: "cobranca",
    label: "Cobrança",
    message: "Olá {nome}! Passando para lembrar do seu pagamento 📅 Em caso de dúvida, estou à disposição. Agradeço a atenção!",
  },
  {
    code: "novo_produto",
    label: "Novo produto",
    message: "Olá {nome}! Chegaram novidades incríveis ✨ Quer conhecer os novos produtos? Fico à disposição! 💚",
  },
  {
    code: "agradecimento",
    label: "Agradecimento",
    message: "Olá {nome}! Só passando para agradecer sua confiança 💚 É uma honra cuidar da sua rotina com os melhores óleos essenciais!",
  },
];

export const WHATSAPP_PROVIDERS = [
  { code: "simples", label: "Modo simples — link direto (sem API) ✨ Gratuito" },
  { code: "meta", label: "Meta WhatsApp Cloud API" },
  { code: "zapi", label: "Z-API" },
  { code: "evolution", label: "Evolution API" },
  { code: "outros", label: "Outro (compatível)" },
];

export const VIP_DEFAULT_RULES = {
  minSpentCents: 100000,
  minPurchases: 3,
  minPoints: 0,
  reorderMonths: 6,
};

export const DEFAULT_LEVELS = [
  { name: "Bronze", min_points: 0 },
  { name: "Prata", min_points: 100 },
  { name: "Ouro", min_points: 300 },
  { name: "VIP", min_points: 600 },
];

export const DEFAULT_FINANCIAL_CATEGORIES = {
  income: ["Vendas", "Outros recebimentos"],
  expense: ["Despesas", "Custos", "Outros gastos"],
};

export function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return "";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length < 11) return cpf;
  return `***.${digits.slice(3, 6)}.***-${digits.slice(9)}`;
}

export function parseCents(value: string | number): number {
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.,-]/g, "").replace(".", "").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n);
}