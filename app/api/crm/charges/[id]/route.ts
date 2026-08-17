import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** PUT /api/crm/charges/[id] — atualiza cobrança (inclusive status/baixa). */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const payload: Record<string, unknown> = {};
  for (const k of ["due_date", "payment_method", "notes", "client_id", "sale_id"] as const) {
    if (body[k] !== undefined) payload[k] = body[k] === "" ? null : body[k];
  }
  if (body.amount_cents !== undefined) {
    const amount = Math.round(Number(body.amount_cents) || 0);
    if (amount <= 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    payload.amount_cents = amount;
  }
  if (body.status !== undefined) {
    payload.status = String(body.status);
    if (body.status === "Pago" && body.paid_at === undefined) payload.paid_at = new Date().toISOString();
    if (body.status !== "Pago") payload.paid_at = null;
  }
  const { data: current } = await admin.from("crm_charges").select("client_id, status").eq("id", params.id).eq("tenant_id", tenant!.id).maybeSingle();
  const { error: err } = await admin.from("crm_charges").update(payload).eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao atualizar cobrança." }, { status: 500 });

  if (body.status === "Pago" && current?.client_id && current.status !== "Pago") {
    await admin.from("crm_client_timeline").insert({
      tenant_id: tenant!.id,
      client_id: current.client_id,
      event_type: "beneficio",
      title: "Cobrança quitada",
      description: "Pagamento recebido",
      event_at: new Date().toISOString(),
    });
  }

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_charge_update",
    entity_type: "crm_charges",
    entity_id: params.id,
    metadata: { fields: Object.keys(payload) },
  });
  return NextResponse.json({ success: true });
}

/** DELETE /api/crm/charges/[id] — remove cobrança. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const { error: err } = await admin.from("crm_charges").delete().eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao excluir cobrança." }, { status: 500 });
  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_charge_delete",
    entity_type: "crm_charges",
    entity_id: params.id,
    metadata: {},
  });
  return NextResponse.json({ success: true });
}