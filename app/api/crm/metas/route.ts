import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import {
  currentPeriod,
  getMonthWindow,
  getSemesterWindow,
  getYearWindow,
  windowForGoal,
  computeGoalProgress,
  generateRecommendations,
  sumSalesInWindow,
} from "@/lib/crm-metas";
import type { CrmGoal } from "@/types";

export const runtime = "nodejs";

/** GET /api/crm/metas — resumo mensal/semestral/anual + recomendações + checklist + histórico. */
export async function GET() {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const tenantId = tenant!.id;
  const now = new Date();
  const cp = currentPeriod(now);
  const todayISO = now.toISOString().slice(0, 10);

  const monthWindow = getMonthWindow(cp.year, cp.month);
  const semesterWindow = getSemesterWindow(cp.year, cp.semester);
  const yearWindow = getYearWindow(cp.year);

  try {
    const [{ data: metas }, { data: sales }, { data: clients }, { data: tasks }, { data: checks }] = await Promise.all([
      admin.from("crm_metas").select("*").eq("tenant_id", tenantId),
      admin
        .from("crm_sales")
        .select("status, total_cents, sale_date")
        .eq("tenant_id", tenantId)
        .gte("sale_date", `${cp.year - 1}-01-01`),
      admin.from("crm_clients").select("id, category, last_contact_at, last_purchase_at").eq("tenant_id", tenantId),
      admin.from("crm_tasks").select("id, status").eq("tenant_id", tenantId).neq("status", "Concluída"),
      admin.from("crm_meta_checks").select("*").eq("tenant_id", tenantId),
    ]);

    const allMetas = (metas as CrmGoal[] | null) || [];
    const allSales = (sales as { status: string; total_cents: number; sale_date: string }[] | null) || [];
    const allClients = (clients as { id: string; category: string; last_contact_at: string | null; last_purchase_at: string | null }[] | null) || [];
    const pendingTasks = (tasks as { id: string }[] | null) || [];
    const allChecks = (checks as any[] | null) || [];

    const findMeta = (type: string, year: number, month: number | null, semester: number | null) =>
      allMetas.find(
        (m) => m.type === type && m.year === year && (m.month || null) === month && (m.semester || null) === semester
      );

    const monthlyMeta = findMeta("monthly", cp.year, cp.month, null);
    const semiannualMeta = findMeta("semiannual", cp.year, null, cp.semester);
    const annualMeta = findMeta("annual", cp.year, null, null);

    const buildEntry = (type: "monthly" | "semiannual" | "annual", meta: CrmGoal | undefined, window: { start: string; end: string; label: string; periodKey: string }) => {
      const { realized_cents, realized_sales } = sumSalesInWindow(allSales, window);
      const progress = computeGoalProgress(realized_cents, realized_sales, meta?.target_cents || 0, window, todayISO);
      return {
        ...(meta || null),
        id: meta?.id || null,
        tenant_id: tenantId,
        type,
        year: meta?.year ?? (type === "monthly" ? cp.year : cp.year),
        month: type === "monthly" ? cp.month : null,
        semester: type === "semiannual" ? cp.semester : null,
        target_cents: meta?.target_cents || 0,
        target_sales: meta?.target_sales || 0,
        realized_cents: progress.realized_cents,
        realized_sales: progress.realized_sales,
        missing_cents: progress.missing_cents,
        percent: progress.percent,
        projected_cents: progress.projected_cents,
        pace: progress.pace,
        period_start: window.start,
        period_end: window.end,
        period_label: window.label,
        period_key: window.periodKey,
        diagnosis: progress.diagnosis,
        remaining_days: progress.remaining_days,
        daily_needed_cents: progress.daily_needed_cents,
      };
    };

    const monthly = buildEntry("monthly", monthlyMeta, monthWindow);
    const semiannual = buildEntry("semiannual", semiannualMeta, semesterWindow);
    const annual = buildEntry("annual", annualMeta, yearWindow);

    // ---- Sinais para recomendações (dados reais) ----
    const noContact = allClients.filter((c) => {
      const refs = [c.last_contact_at, c.last_purchase_at].filter(Boolean) as string[];
      if (!refs.length) return true;
      const latest = Math.max(...refs.map((r) => new Date(r).getTime()));
      return Date.now() - latest > 30 * 86400000;
    });
    const leads = allClients.filter((c) => c.category === "Lead");
    const monthSales = allSales.filter(
      (s) => s.sale_date >= monthWindow.start && s.sale_date <= monthWindow.end && s.status !== "Cancelado" && s.status !== "Reembolsado"
    );
    const ticketAvg = monthSales.length ? Math.round(monthSales.reduce((a, s) => a + (s.total_cents || 0), 0) / monthSales.length) : 15000;

    const recommendations = generateRecommendations({
      noContactCount: noContact.length,
      leadsCount: leads.length,
      pendingTasksCount: pendingTasks.length,
      monthSalesCount: monthSales.length,
      ticketAvgCents: ticketAvg,
      percent: monthly.percent,
      missing_cents: monthly.missing_cents,
    });

    const checkByKey = new Map(allChecks.map((c: any) => [`${c.meta_id}:${c.action_key}`, c]));
    const monthlyMetaId = monthlyMeta?.id || null;
    const recommendationsWithStatus = recommendations.map((r) => ({
      ...r,
      status: (monthlyMetaId ? checkByKey.get(`${monthlyMetaId}:${r.action_key}`)?.status : undefined) || "pending",
    }));

    // ---- Histórico: últimos 6 meses (usa meta mensal encontrada ou alvo atual) ----
    const history: { key: string; label: string; realized_cents: number; target_cents: number; percent: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(cp.year, cp.month - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const w = getMonthWindow(y, m);
      const { realized_cents } = sumSalesInWindow(allSales, w);
      const pastMeta = allMetas.find((x) => x.type === "monthly" && x.year === y && x.month === m);
      const target = pastMeta?.target_cents || (i === 0 ? monthly.target_cents : 0);
      history.push({
        key: w.periodKey,
        label: w.label,
        realized_cents,
        target_cents: target,
        percent: target > 0 ? Math.round((realized_cents / target) * 100) : 0,
      });
    }

    const currentCheckList = monthlyMetaId ? allChecks.filter((c: any) => c.meta_id === monthlyMetaId) : [];

    return NextResponse.json({
      now: cp,
      goals: { monthly, semiannual, annual },
      recommendations: recommendationsWithStatus,
      checks: currentCheckList,
      history,
      counts: {
        noContact: noContact.length,
        leads: leads.length,
        pendingTasks: pendingTasks.length,
        monthSales: monthSales.length,
        ticketAvgCents: ticketAvg,
      },
    });
  } catch (e: any) {
    // Tabela ainda não criada (migration pendente) → front exibe estado de configuração.
    if (String(e?.message || e).includes("crm_metas") || String(e?.code) === "42P01") {
      return NextResponse.json({ needsSetup: true, error: "Migration 0042 pendente." });
    }
    return NextResponse.json({ error: "Erro ao carregar metas." }, { status: 500 });
  }
}

/** POST /api/crm/metas — cria ou atualiza meta do período. */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const type = String(body.type || "monthly");
  if (!["monthly", "semiannual", "annual"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido. Use monthly, semiannual ou annual." }, { status: 400 });
  }
  const cp = currentPeriod();
  const year = Number(body.year || cp.year);
  const month = type === "monthly" ? Number(body.month || cp.month) : null;
  const semester = type === "semiannual" ? Number(body.semester || cp.semester) : null;
  const target_cents = Math.max(0, Math.round(Number(body.target_cents ?? body.target ?? 0)));
  if (!target_cents || target_cents <= 0) {
    return NextResponse.json({ error: "Informe o valor da meta (maior que zero)." }, { status: 400 });
  }
  if (type === "monthly" && (month! < 1 || month! > 12)) {
    return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  }
  if (type === "semiannual" && semester !== 1 && semester !== 2) {
    return NextResponse.json({ error: "Semestre inválido (1 ou 2)." }, { status: 400 });
  }
  const window = windowForGoal(type as "monthly" | "semiannual" | "annual", year, month, semester);

  try {
    const { data: existing } = await admin
      .from("crm_metas")
      .select("*")
      .eq("tenant_id", tenant!.id)
      .eq("type", type)
      .eq("year", year)
      .eq("month", month as never)
      .eq("semester", semester as never)
      .maybeSingle();

    // Supabase trata NULL com IS NULL; o filtro acima pode não casar. Busca ampla como fallback.
    let current = existing as any;
    if (!current) {
      const { data: all } = await admin.from("crm_metas").select("*").eq("tenant_id", tenant!.id).eq("type", type).eq("year", year);
      current = ((all as any[]) || []).find((m) => (m.month || null) === month && (m.semester || null) === semester) || null;
    }

    if (current) {
      const { data, error: err } = await admin
        .from("crm_metas")
        .update({ target_cents, updated_at: new Date().toISOString() })
        .eq("id", current.id)
        .eq("tenant_id", tenant!.id)
        .select()
        .single();
      if (err) return NextResponse.json({ error: "Erro ao atualizar meta." }, { status: 500 });
      return NextResponse.json({ success: true, goal: data });
    }

    const { data, error: err } = await admin
      .from("crm_metas")
      .insert({
        tenant_id: tenant!.id,
        user_id: user!.id,
        type,
        year,
        month,
        semester,
        target_cents,
        target_sales: Math.max(0, Math.round(Number(body.target_sales || 0))),
        name: typeof body.name === "string" ? body.name.slice(0, 120) : window.label,
      })
      .select()
      .single();
    if (err) return NextResponse.json({ error: "Erro ao salvar meta." }, { status: 500 });
    return NextResponse.json({ success: true, goal: data });
  } catch (e: any) {
    if (String(e?.message || e).includes("crm_metas") || String(e?.code) === "42P01") {
      return NextResponse.json({ error: "Migration 0042 pendente. Rode a migration no Supabase." }, { status: 501 });
    }
    return NextResponse.json({ error: "Erro ao salvar meta." }, { status: 500 });
  }
}
