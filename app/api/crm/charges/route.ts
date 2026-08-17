import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { refreshOverdueCharges } from "@/lib/crm";
import type { CrmCharge } from "@/types";

export const runtime = "nodejs";

/** GET /api/crm/charges — cobranças com filtros e resumo. */
export async function GET(request: Request) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  await refreshOverdueCharges(admin, tenant!.id);
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const status = url.searchParams.get("status") || "";
  const clientId = url.searchParams.get("clientId") || "";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const perPage = Math.min(100, Math.max(5, Number(url.searchParams.get("perPage") || 25)));

  let query = admin.from("crm_charges").select("*", { count: "exact" }).eq("tenant_id", tenant!.id);
  if (from) query = query.gte("due_date", from);
  if (to) query = query.lte("due_date", to);
  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  query = query.order("due_date", { ascending: false }).range((page - 1) * perPage, page * perPage - 1);

  const { data, count, error: err } = await query;
  if (err) return NextResponse.json({ error: "Erro ao buscar cobranças." }, { status: 500 });

  const { data: all } = await admin.from("crm_charges").select("status, amount_cents, due_date").eq("tenant_id", tenant!.id).limit(5000);
  let toReceive = 0;
  let received = 0;
  let overdue = 0;
  for (const c of all || []) {
    if (c.status === "Pago") received += c.amount_cents;
    else if (c.status === "Vencido") {
      overdue += c.amount_cents;
      toReceive += c.amount_cents;
    } else if (c.status === "Pendente") toReceive += c.amount_cents;
  }
  const upcoming = (all || []).filter((c) => c.status === "Pendente" && c.due_date >= new Date().toISOString().slice(0, 10)).length;

  const rows = (data as CrmCharge[]) || [];
  const clientIds = Array.from(new Set(rows.map((r) => r.client_id).filter(Boolean) as string[]));
  const { data: clients } = clientIds.length ? await admin.from("crm_clients").select("id, name").in("id", clientIds).eq("tenant_id", tenant!.id) : { data: [] };
  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));

  return NextResponse.json({
    charges: rows.map((r) => ({ ...r, client_name: r.client_id ? nameById.get(r.client_id) || null : null })),
    total: count || 0,
    totalPages: Math.ceil((count || 0) / perPage),
    summary: { toReceive, received, overdue, upcoming },
  });
}

/** POST /api/crm/charges — cria cobrança. */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const amount = Math.round(Number(body.amount_cents) || 0);
  if (amount <= 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  const dueDate = body.due_date || new Date().toISOString().slice(0, 10);
  if (body.client_id) {
    const { data: c } = await admin.from("crm_clients").select("id").eq("id", body.client_id).eq("tenant_id", tenant!.id).maybeSingle();
    if (!c) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 400 });
  }

  const status = body.status || (dueDate < new Date().toISOString().slice(0, 10) ? "Vencido" : "Pendente");
  const { data, error: err } = await admin
    .from("crm_charges")
    .insert({
      tenant_id: tenant!.id,
      user_id: user!.id,
      client_id: body.client_id || null,
      sale_id: body.sale_id || null,
      amount_cents: amount,
      due_date: dueDate,
      payment_method: body.payment_method || null,
      status,
      paid_at: status === "Pago" ? new Date().toISOString() : null,
      notes: body.notes || null,
    })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao criar cobrança." }, { status: 500 });

  if (body.client_id) {
    await admin.from("crm_client_timeline").insert({
      tenant_id: tenant!.id,
      client_id: body.client_id,
      event_type: "cobranca",
      title: `Cobrança criada — ${(amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      description: `Vencimento ${new Date(dueDate + "T00:00:00").toLocaleDateString("pt-BR")}`,
      event_at: new Date().toISOString(),
    });
  }

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_charge_create",
    entity_type: "crm_charges",
    entity_id: data.id,
    metadata: { amount_cents: amount },
  });
  return NextResponse.json({ success: true, charge: data });
}
