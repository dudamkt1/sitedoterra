import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import type { CrmFinancialEntry } from "@/types";

export const runtime = "nodejs";

/** GET /api/crm/financial — entradas e saídas com filtros e resumo. */
export async function GET(request: Request) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const type = url.searchParams.get("type") || "";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const perPage = Math.min(100, Math.max(5, Number(url.searchParams.get("perPage") || 25)));

  let query = admin.from("crm_financial_entries").select("*", { count: "exact" }).eq("tenant_id", tenant!.id);
  if (from) query = query.gte("entry_date", from);
  if (to) query = query.lte("entry_date", to);
  if (type) query = query.eq("type", type);
  query = query.order("entry_date", { ascending: false }).order("created_at", { ascending: false }).range((page - 1) * perPage, page * perPage - 1);

  const { data, count, error: err } = await query;
  if (err) return NextResponse.json({ error: "Erro ao buscar lançamentos." }, { status: 500 });

  // Resumo do período
  let summaryQuery = admin.from("crm_financial_entries").select("type, amount_cents").eq("tenant_id", tenant!.id);
  if (from) summaryQuery = summaryQuery.gte("entry_date", from);
  if (to) summaryQuery = summaryQuery.lte("entry_date", to);
  const { data: all } = await summaryQuery.limit(5000);
  let income = 0;
  let expense = 0;
  for (const e of all || []) {
    if (e.type === "income") income += e.amount_cents;
    else expense += e.amount_cents;
  }

  const rows = (data as CrmFinancialEntry[]) || [];
  const clientIds = Array.from(new Set(rows.map((r) => r.client_id).filter(Boolean) as string[]));
  const { data: clients } = clientIds.length ? await admin.from("crm_clients").select("id, name").in("id", clientIds).eq("tenant_id", tenant!.id) : { data: [] };
  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));

  return NextResponse.json({
    entries: rows.map((r) => ({ ...r, client_name: r.client_id ? nameById.get(r.client_id) || null : null })),
    total: count || 0,
    totalPages: Math.ceil((count || 0) / perPage),
    summary: { income, expense, result: income - expense },
  });
}

/** POST /api/crm/financial — registra entrada/saída. */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const type = body.type === "expense" ? "expense" : "income";
  const amount = Math.round(Number(body.amount_cents) || 0);
  if (amount <= 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  if (!body.description && !body.category) return NextResponse.json({ error: "Informe uma descrição." }, { status: 400 });

  const { data, error: err } = await admin
    .from("crm_financial_entries")
    .insert({
      tenant_id: tenant!.id,
      user_id: user!.id,
      client_id: body.client_id || null,
      type,
      category: body.category || null,
      description: body.description || null,
      amount_cents: amount,
      entry_date: body.entry_date || new Date().toISOString().slice(0, 10),
      payment_method: body.payment_method || null,
      notes: body.notes || null,
    })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao registrar lançamento." }, { status: 500 });
  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_financial_create",
    entity_type: "crm_financial_entries",
    entity_id: data.id,
    metadata: { type, amount_cents: amount },
  });
  return NextResponse.json({ success: true, entry: data });
}
