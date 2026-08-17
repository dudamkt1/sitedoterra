import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, keyHint } from "@/lib/crypto";
import {
  DEFAULT_CLIENT_CATEGORIES,
  DEFAULT_FINANCIAL_CATEGORIES,
  DEFAULT_LEVELS,
  VIP_DEFAULT_RULES,
} from "@/lib/crm-shared";
import type {
  CrmSettings,
  CrmLoyaltySettings,
  CrmWhatsAppConfig,
  CrmClient,
  CrmSale,
  CrmCharge,
  CrmTask,
  CrmProduct,
  CrmModuleCode,
} from "@/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export function crmModuleEnabled(settings: CrmSettings | null | undefined, code: CrmModuleCode): boolean {
  if (!settings) return true;
  return settings.modules?.[code] !== false;
}

export function normalizeCrmSettings(tenantId: string, data: Partial<CrmSettings> | null): CrmSettings {
  return {
    tenant_id: tenantId,
    currency: data?.currency || "BRL",
    modules: data?.modules || {},
    vip_rules: { ...VIP_DEFAULT_RULES, ...(data?.vip_rules || {}) },
    categories: Array.isArray(data?.categories) && data.categories.length ? data.categories : DEFAULT_CLIENT_CATEGORIES,
    financial_categories: {
      ...DEFAULT_FINANCIAL_CATEGORIES,
      ...(data?.financial_categories || {}),
    },
  };
}

export async function getCrmSettings(admin: AdminClient, tenantId: string): Promise<CrmSettings> {
  const { data } = await admin.from("crm_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  return normalizeCrmSettings(tenantId, data as Partial<CrmSettings> | null);
}

export async function upsertCrmSettings(admin: AdminClient, tenantId: string, patch: Partial<CrmSettings>) {
  const { data } = await admin.from("crm_settings").select("tenant_id").eq("tenant_id", tenantId).maybeSingle();
  if (data) {
    const { error } = await admin.from("crm_settings").update(patch).eq("tenant_id", tenantId);
    return { error };
  }
  const { error } = await admin.from("crm_settings").insert({ tenant_id: tenantId, ...patch });
  return { error };
}

export async function getLoyaltySettings(admin: AdminClient, tenantId: string): Promise<CrmLoyaltySettings> {
  const { data } = await admin.from("crm_loyalty_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  return {
    tenant_id: tenantId,
    enabled: data?.enabled ?? false,
    program_name: data?.program_name || "Programa de Fidelidade",
    points_per_purchase_cents: data?.points_per_purchase_cents ?? 10,
    points_per_referral: data?.points_per_referral ?? 50,
    points_per_birthday: data?.points_per_birthday ?? 100,
    points_per_special: data?.points_per_special ?? 20,
    rules: Array.isArray(data?.rules) ? data.rules : [],
    benefits: Array.isArray(data?.benefits) ? data.benefits : [],
    rewards: Array.isArray(data?.rewards) ? data.rewards : [],
    levels: Array.isArray(data?.levels) && data.levels.length ? data.levels : DEFAULT_LEVELS,
  };
}

export async function getWhatsAppConfig(admin: AdminClient, tenantId: string): Promise<CrmWhatsAppConfig> {
  const { data } = await admin.from("crm_whatsapp_config").select("*").eq("tenant_id", tenantId).maybeSingle();
  return {
    tenant_id: tenantId,
    enabled: data?.enabled ?? false,
    provider: data?.provider || null,
    api_url: data?.api_url || null,
    phone_id: data?.phone_id || null,
    webhook_url: data?.webhook_url || null,
    connection_status: data?.connection_status || "not_configured",
    created_at: data?.created_at || new Date().toISOString(),
    updated_at: data?.updated_at || new Date().toISOString(),
    has_token: !!(data?.access_token_enc && decryptSecret(data.access_token_enc)),
    key_hint: keyHint(data?.access_token_enc),
  };
}

/** Números úteis de uma venda considerando canceladas/reembolsadas. */
export function saleEffectiveCents(sale: Pick<CrmSale, "status" | "total_cents">): number {
  if (sale.status === "Cancelado" || sale.status === "Reembolsado") return 0;
  return sale.total_cents;
}

/** Calcula métricas agregadas de clientes a partir das vendas (Pago/Parcial). */
export function computeClientMetrics(
  clients: Pick<CrmClient, "id">[],
  sales: Pick<CrmSale, "client_id" | "status" | "total_cents" | "sale_date">[],
  points: { client_id: string; sum: number }[]
): Map<string, { total_spent_cents: number; purchase_count: number; ticket_avg_cents: number; first_purchase_at: string | null; last_purchase_at: string | null; points_balance: number }> {
  const map = new Map<
    string,
    { total_spent_cents: number; purchase_count: number; ticket_avg_cents: number; first_purchase_at: string | null; last_purchase_at: string | null; points_balance: number }
  >();
  for (const c of clients) {
    map.set(c.id, { total_spent_cents: 0, purchase_count: 0, ticket_avg_cents: 0, first_purchase_at: null, last_purchase_at: null, points_balance: 0 });
  }
  for (const s of sales) {
    const row = map.get(s.client_id || "");
    if (!row) continue;
    const value = saleEffectiveCents(s);
    if (value > 0) {
      row.total_spent_cents += value;
      row.purchase_count += 1;
      if (!row.first_purchase_at || (s.sale_date && s.sale_date < row.first_purchase_at)) row.first_purchase_at = s.sale_date;
      if (!row.last_purchase_at || (s.sale_date && s.sale_date > row.last_purchase_at)) row.last_purchase_at = s.sale_date;
    }
  }
  for (const p of points) {
    const row = map.get(p.client_id);
    if (row) row.points_balance = p.sum;
  }
  for (const row of Array.from(map.values())) {
    if (row.purchase_count > 0) row.ticket_avg_cents = Math.round(row.total_spent_cents / row.purchase_count);
  }
  return map;
}

export async function attachClientMetrics(
  admin: AdminClient,
  tenantId: string,
  clients: CrmClient[]
): Promise<CrmClient[]> {
  if (!clients.length) return clients;
  const ids = clients.map((c) => c.id);
  const [{ data: sales }, { data: points }] = await Promise.all([
    admin.from("crm_sales").select("client_id, status, total_cents, sale_date").in("client_id", ids).eq("tenant_id", tenantId),
    admin.from("crm_loyalty_points").select("client_id, amount").in("client_id", ids).eq("tenant_id", tenantId),
  ]);
  const pointsSum = new Map<string, number>();
  for (const p of points || []) pointsSum.set(p.client_id, (pointsSum.get(p.client_id) || 0) + (p.amount || 0));
  const metrics = computeClientMetrics(clients, (sales || []) as any, Array.from(pointsSum, ([client_id, sum]) => ({ client_id, sum })));
  return clients.map((c) => {
    const m = metrics.get(c.id);
    return {
      ...c,
      total_spent_cents: m?.total_spent_cents ?? 0,
      purchase_count: m?.purchase_count ?? 0,
      ticket_avg_cents: m?.ticket_avg_cents ?? 0,
      points_balance: m?.points_balance ?? 0,
    };
  });
}

export async function applyVipRules(
  admin: AdminClient,
  tenantId: string,
  settings: CrmSettings
): Promise<void> {
  const rules = settings.vip_rules;
  const { data: clients } = await admin
    .from("crm_clients")
    .select("id")
    .eq("tenant_id", tenantId);
  if (!clients?.length) return;
  const ids = clients.map((c) => c.id);
  const { data: sales } = await admin
    .from("crm_sales")
    .select("client_id, status, total_cents, sale_date")
    .in("client_id", ids)
    .eq("tenant_id", tenantId);
  const metrics = computeClientMetrics(clients as any, (sales || []) as any, []);
  const now = new Date();
  for (const c of clients as CrmClient[]) {
    const m = metrics.get(c.id);
    if (!m) continue;
    let vip = true;
    if (rules.minSpentCents && m.total_spent_cents < rules.minSpentCents) vip = false;
    if (vip && rules.minPurchases && m.purchase_count < rules.minPurchases) vip = false;
    if (vip && rules.minPoints) {
      const { data: pts } = await admin
        .from("crm_loyalty_points")
        .select("amount")
        .eq("client_id", c.id)
        .eq("tenant_id", tenantId);
      const total = (pts || []).reduce((s, p) => s + (p.amount || 0), 0);
      if (total < rules.minPoints) vip = false;
    }
    if (vip && rules.reorderMonths && m.last_purchase_at) {
      const months = (now.getTime() - new Date(m.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (months > rules.reorderMonths) vip = false;
    }
    if (c.is_vip !== vip) {
      await admin.from("crm_clients").update({ is_vip: vip }).eq("id", c.id).eq("tenant_id", tenantId);
    }
  }
}

export async function autoTimestampSaleMetrics(
  admin: AdminClient,
  tenantId: string,
  clientId: string
): Promise<void> {
  const { data: sales } = await admin
    .from("crm_sales")
    .select("sale_date, status, total_cents")
    .eq("client_id", clientId)
    .eq("tenant_id", tenantId)
    .order("sale_date", { ascending: true });
  const active = (sales || []).filter((s) => s.status !== "Cancelado" && s.status !== "Reembolsado");
  const first = active[0]?.sale_date || null;
  const last = active.length ? active[active.length - 1].sale_date : null;
  await admin
    .from("crm_clients")
    .update({ first_purchase_at: first, last_purchase_at: last, updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("tenant_id", tenantId);
}

export function clientHasRecentActivity(client: CrmClient, days = 30): boolean {
  const refs = [client.last_purchase_at, client.last_contact_at].filter(Boolean);
  if (!refs.length) return false;
  const latest = new Date(Math.max(...refs.map((r) => new Date(r as string).getTime())));
  const diff = (Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= days;
}

export function clientLevel(client: CrmClient, levels: { name: string; min_points: number }[]): string {
  const sorted = [...levels].sort((a, b) => a.min_points - b.min_points);
  let level = sorted[0]?.name || "Bronze";
  for (const l of sorted) {
    if ((client.points_balance || 0) >= l.min_points) level = l.name;
  }
  return level;
}

/** Análise de cobranças: marca como Vencido as pendentes com data < hoje. */
export async function refreshOverdueCharges(admin: AdminClient, tenantId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await admin
    .from("crm_charges")
    .update({ status: "Vencido", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("status", "Pendente")
    .lt("due_date", today);
}

export async function computeDashboardStats(
  admin: AdminClient,
  tenantId: string,
  settings: CrmSettings,
  consultantName: string | null
) {
  await refreshOverdueCharges(admin, tenantId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayISO = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [clientsRes, salesRes, chargesRes, tasksRes, salesMonthRes] = await Promise.all([
    admin.from("crm_clients").select("*").eq("tenant_id", tenantId),
    admin.from("crm_sales").select("client_id, status, total_cents, sale_date, created_at").eq("tenant_id", tenantId),
    admin.from("crm_charges").select("status, amount_cents, due_date").eq("tenant_id", tenantId),
    admin.from("crm_tasks").select("*").eq("tenant_id", tenantId).neq("status", "Concluída").order("due_date", { ascending: true }).limit(10),
    admin.from("crm_sales").select("status, total_cents, sale_date").eq("tenant_id", tenantId).gte("sale_date", monthStart.slice(0, 10)),
  ]);

  const clients = clientsRes.data as CrmClient[] | null || [];
  const sales = salesRes.data as any[] || [];
  const charges = chargesRes.data as any[] || [];
  const tasks = (tasksRes.data as CrmTask[] | null || []) as CrmTask[];

  const activeClients = clients.filter((c) => c.category !== "Cliente inativo" && c.category !== "Cliente perdido" && c.category !== "Lead").length;
  const vipClients = clients.filter((c) => c.is_vip).length;

  const monthRevenue = (salesMonthRes.data || []).reduce((s, x) => s + saleEffectiveCents(x), 0);
  const monthSales = (salesMonthRes.data || []).filter((x) => saleEffectiveCents(x) > 0).length;

  const receivable = charges.reduce((s, c) => (c.status === "Pendente" || c.status === "Vencido" ? s + c.amount_cents : s), 0);
  const pendingCharges = charges.filter((c) => c.status === "Pendente").length;
  const overdueCharges = charges.filter((c) => c.status === "Vencido").length;

  const metricsMap = computeClientMetrics(clients, sales, []);
  const needsAttention = clients
    .filter((c) => {
      const m = metricsMap.get(c.id);
      const latest = [c.last_contact_at, m?.last_purchase_at || c.last_purchase_at].filter(Boolean);
      if (!latest.length) return true;
      const diff = (Date.now() - new Date(Math.max(...latest.map((x) => new Date(x as string).getTime()))).getTime()) / (1000 * 60 * 60 * 24);
      return diff > 30;
    })
    .slice(0, 8);

  const upcomingBirthdays = clients
    .filter((c) => c.birth_date)
    .map((c) => ({ ...c, _monthDay: `${c.birth_date!.slice(5, 7)}-${c.birth_date!.slice(8, 10)}` }))
    .filter((c) => {
      const md = c._monthDay;
      const nowMD = `${todayISO.slice(5, 7)}-${todayISO.slice(8, 10)}`;
      const diffDays = md >= nowMD ? 0 : 366;
      return md < nowMD ? md.slice(0, 2) === todayISO.slice(5, 7) : md.slice(0, 2) === todayISO.slice(5, 7);
    })
    .sort((a, b) => a._monthDay.localeCompare(b._monthDay))
    .slice(0, 6)
    .map((c) => ({ id: c.id, name: c.name, birth_date: c.birth_date }));

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }) };
  });
  const revenueByMonth = months.map((m) => {
    const rows = (salesMonthRes.data || []).filter((s) => (s.sale_date || "").startsWith(m.key));
    const total = rows.reduce((s, x) => s + saleEffectiveCents(x), 0);
    return { month: m.label, total_cents: total, sales: rows.filter((x) => saleEffectiveCents(x) > 0).length };
  });

  const sortedClients = [...clients].sort((a, b) => {
    const am = metricsMap.get(a.id)?.total_spent_cents || 0;
    const bm = metricsMap.get(b.id)?.total_spent_cents || 0;
    return bm - am;
  });
  const vipClientsList = sortedClients.filter((c) => c.is_vip).slice(0, 6);

  return {
    activeClients,
    vipClients,
    monthSales,
    monthRevenueCents: monthRevenue,
    receivableCents: receivable,
    pendingCharges,
    overdueCharges,
    clientsWithoutRecentContact: needsAttention.length,
    upcomingBirthdays,
    upcomingTasks: tasks,
    vipClientsList: await attachClientMetrics(admin, tenantId, vipClientsList),
    needsAttention: await attachClientMetrics(admin, tenantId, needsAttention),
    revenueByMonth,
    consultantName,
    currency: settings.currency,
  };
}