/** Lógica determinística de Minhas Metas — sem IA externa, sem API externa.
 * Fonte oficial de receita: crm_sales.total_cents com status NOT IN ('Cancelado','Reembolsado').
 * Mesma regra de saleEffectiveCents() em lib/crm.ts.
 */

export type GoalType = "monthly" | "semiannual" | "annual";
export type GoalPace = "no-target" | "behind" | "on-track" | "ahead" | "achieved";

export interface GoalWindow {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  label: string;
  periodKey: string; // YYYY-MM | YYYY-S1 | YYYY
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function currentPeriod(now = new Date()): { year: number; month: number; semester: 1 | 2 } {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return { year, month, semester: (month <= 6 ? 1 : 2) as 1 | 2 };
}

export function getMonthWindow(year: number, month: number): GoalWindow {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = pad(month);
  const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${pad(lastDay)}`,
    label: label.charAt(0).toUpperCase() + label.slice(1),
    periodKey: `${year}-${mm}`,
  };
}

export function getSemesterWindow(year: number, semester: 1 | 2): GoalWindow {
  const start = semester === 1 ? `${year}-01-01` : `${year}-07-01`;
  const end = semester === 1 ? `${year}-06-30` : `${year}-12-31`;
  return {
    start,
    end,
    label: `${semester}º semestre de ${year}`,
    periodKey: `${year}-S${semester}`,
  };
}

export function getYearWindow(year: number): GoalWindow {
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: `Ano de ${year}`, periodKey: `${year}` };
}

export function windowForGoal(type: GoalType, year: number, month?: number | null, semester?: number | null): GoalWindow {
  if (type === "monthly") return getMonthWindow(year, month || 1);
  if (type === "semiannual") return getSemesterWindow(year, ((semester === 2 ? 2 : 1) as 1 | 2));
  return getYearWindow(year);
}

export interface GoalProgress {
  realized_cents: number;
  realized_sales: number;
  target_cents: number;
  missing_cents: number;
  percent: number;
  projected_cents: number;
  pace: GoalPace;
  elapsed_ratio: number;
  remaining_days: number;
  daily_needed_cents: number;
  diagnosis: string;
}

const DAY_MS = 86400000;

export function computeGoalProgress(
  realized_cents: number,
  realized_sales: number,
  target_cents: number,
  window: GoalWindow,
  nowISO?: string
): GoalProgress {
  const today = (nowISO || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const startMs = new Date(window.start + "T00:00:00").getTime();
  const endMs = new Date(window.end + "T00:00:00").getTime();
  const nowMs = new Date(today + "T00:00:00").getTime();
  const totalDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS) + 1);
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((nowMs - startMs) / DAY_MS) + 1));
  const elapsed_ratio = today < window.start ? 0 : today > window.end ? 1 : elapsedDays / totalDays;
  const remaining_days = today > window.end ? 0 : Math.max(0, totalDays - elapsedDays + (today <= window.end && today >= window.start ? 1 : 0));

  const target = Math.max(0, target_cents || 0);
  const realized = Math.max(0, realized_cents || 0);
  const missing_cents = Math.max(0, target - realized);
  const percent = target > 0 ? Math.round((realized / target) * 100) : 0;
  const projected_cents = elapsed_ratio > 0 ? Math.round(realized / Math.max(elapsed_ratio, 1 / totalDays)) : realized;
  const daily_needed_cents = missing_cents > 0 && remaining_days > 0 ? Math.ceil(missing_cents / remaining_days) : missing_cents;

  let pace: GoalPace = "no-target";
  if (target <= 0) pace = "no-target";
  else if (percent >= 100) pace = "achieved";
  else {
    const expected = target * elapsed_ratio;
    if (realized >= expected) pace = "ahead";
    else if (realized >= expected * 0.9) pace = "on-track";
    else pace = "behind";
  }

  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  let diagnosis: string;
  if (target <= 0) diagnosis = "Defina sua meta para acompanhar o ritmo aqui.";
  else if (pace === "achieved") diagnosis = `Meta batida! Você atingiu ${percent}% (${fmt(realized)}).`;
  else if (pace === "ahead") diagnosis = `Acima do ritmo: ${percent}% atingido, faltam ${fmt(missing_cents)}.`;
  else if (pace === "on-track") diagnosis = `No ritmo: ${percent}% atingido, faltam ${fmt(missing_cents)}.`;
  else diagnosis = `Atenção: ${percent}% atingido — faltam ${fmt(missing_cents)} (${fmt(daily_needed_cents)}/dia).`;

  return {
    realized_cents: realized,
    realized_sales,
    target_cents: target,
    missing_cents,
    percent,
    projected_cents,
    pace,
    elapsed_ratio,
    remaining_days,
    daily_needed_cents,
    diagnosis,
  };
}

// ---------------------------------------------------------------------------
// Recomendações determinísticas (regras locais sobre dados reais do CRM)
// ---------------------------------------------------------------------------

export interface RecommendationInput {
  noContactCount: number;
  leadsCount: number;
  pendingTasksCount: number;
  monthSalesCount: number;
  ticketAvgCents: number;
  percent: number;
  missing_cents: number;
}

export interface Recommendation {
  action_key: string;
  title: string;
  detail: string;
  href: string;
  priority: 1 | 2 | 3;
  count: number;
}

export function generateRecommendations(input: RecommendationInput): Recommendation[] {
  const out: Recommendation[] = [];
  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (input.noContactCount > 0) {
    out.push({
      action_key: "reactivate",
      title: `Reativar ${input.noContactCount} cliente(s) sem contato há +30 dias`,
      detail: "Quem não compra há tempo responde bem a uma mensagem direta.",
      href: "/painel/crm/clientes?noContact=1",
      priority: 1,
      count: input.noContactCount,
    });
  }
  if (input.leadsCount > 0) {
    out.push({
      action_key: "leads",
      title: `Converter ${input.leadsCount} oportunidade(s) (Leads)`,
      detail: "Leads parados são a forma mais rápida de gerar venda nova.",
      href: "/painel/crm/clientes?category=Lead",
      priority: 1,
      count: input.leadsCount,
    });
  }
  if (input.pendingTasksCount > 0) {
    out.push({
      action_key: "tasks",
      title: `Concluir ${input.pendingTasksCount} tarefa(s) pendente(s)`,
      detail: "Follow-ups esquecidos costumam travar o faturamento.",
      href: "/painel/crm/tarefas",
      priority: 2,
      count: input.pendingTasksCount,
    });
  }
  if (input.missing_cents > 0 && input.percent < 100) {
    const ticket = input.ticketAvgCents > 0 ? input.ticketAvgCents : 15000;
    const salesNeeded = Math.max(1, Math.ceil(input.missing_cents / ticket));
    out.push({
      action_key: "close-gap",
      title: `Fechar a diferença de ${fmt(input.missing_cents)} (~${salesNeeded} venda(s))`,
      detail: `Ticket médio considerado: ${fmt(ticket)}.`,
      href: "/painel/crm/vendas",
      priority: 2,
      count: salesNeeded,
    });
  }
  if (input.monthSalesCount === 0) {
    out.push({
      action_key: "first-sale",
      title: "Registrar a primeira venda do período",
      detail: "A primeira venda destrava o ritmo do mês.",
      href: "/painel/crm/vendas",
      priority: 1,
      count: 1,
    });
  }
  if (out.length === 0) {
    out.push({
      action_key: "vips",
      title: "Acompanhar clientes VIP",
      detail: "Manter o ritmo com quem mais compra.",
      href: "/painel/crm/clientes?onlyVip=1",
      priority: 3,
      count: 0,
    });
  }

  return out.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

/** Soma vendas efetivas (exclui Cancelado/Reembolsado) dentro da janela. */
export function sumSalesInWindow(
  sales: { status: string; total_cents: number; sale_date: string }[],
  window: GoalWindow
): { realized_cents: number; realized_sales: number } {
  let realized_cents = 0;
  let realized_sales = 0;
  for (const s of sales) {
    if (s.status === "Cancelado" || s.status === "Reembolsado") continue;
    if (s.sale_date < window.start || s.sale_date > window.end) continue;
    realized_cents += s.total_cents || 0;
    realized_sales += 1;
  }
  return { realized_cents, realized_sales };
}
