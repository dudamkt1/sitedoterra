import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** PUT /api/crm/financial/[id] — atualiza lançamento. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const payload: Record<string, unknown> = {};
  for (const k of ["type", "category", "description", "payment_method", "notes", "client_id", "entry_date"] as const) {
    if (body[k] !== undefined) payload[k] = body[k] === "" ? null : body[k];
  }
  if (body.amount_cents !== undefined) {
    const amount = Math.round(Number(body.amount_cents) || 0);
    if (amount <= 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    payload.amount_cents = amount;
  }
  const { error: err } = await admin.from("crm_financial_entries").update(payload).eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao atualizar lançamento." }, { status: 500 });
  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_financial_update",
    entity_type: "crm_financial_entries",
    entity_id: params.id,
    metadata: { fields: Object.keys(payload) },
  });
  return NextResponse.json({ success: true });
}

/** DELETE /api/crm/financial/[id] — remove lançamento. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const { error: err } = await admin.from("crm_financial_entries").delete().eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao excluir lançamento." }, { status: 500 });
  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_financial_delete",
    entity_type: "crm_financial_entries",
    entity_id: params.id,
    metadata: {},
  });
  return NextResponse.json({ success: true });
}
