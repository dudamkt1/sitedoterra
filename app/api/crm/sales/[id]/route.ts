import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { autoTimestampSaleMetrics, getCrmSettings, applyVipRules } from "@/lib/crm";

export const runtime = "nodejs";

/** GET /api/crm/sales/[id] — detalhe da venda com itens e cliente. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const [{ data: sale }, { data: items }] = await Promise.all([
    admin.from("crm_sales").select("*").eq("id", params.id).eq("tenant_id", tenant!.id).maybeSingle(),
    admin.from("crm_sale_items").select("*").eq("sale_id", params.id).eq("tenant_id", tenant!.id),
  ]);
  if (!sale) return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 });
  let client = null;
  if (sale.client_id) {
    const { data: c } = await admin.from("crm_clients").select("id, name, whatsapp, phone, email").eq("id", sale.client_id).eq("tenant_id", tenant!.id).maybeSingle();
    client = c;
  }
  return NextResponse.json({ sale, items: items || [], client });
}

/** PUT /api/crm/sales/[id] — atualiza dados da venda. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const payload: Record<string, unknown> = {};
  for (const k of ["sale_date", "payment_method", "status", "notes", "client_id"] as const) {
    if (body[k] !== undefined) payload[k] = body[k] === "" ? null : body[k];
  }
  if (body.discount_cents !== undefined || body.total_cents !== undefined) {
    payload.discount_cents = Math.max(0, Math.round(Number(body.discount_cents) || 0));
    payload.total_cents = Math.round(Number(body.total_cents) || 0);
  }
  const { error: err } = await admin.from("crm_sales").update(payload).eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao atualizar venda." }, { status: 500 });
  if (body.client_id) {
    await autoTimestampSaleMetrics(admin, tenant!.id, body.client_id);
    const settings = await getCrmSettings(admin, tenant!.id);
    await applyVipRules(admin, tenant!.id, settings);
  }
  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_sale_update",
    entity_type: "crm_sales",
    entity_id: params.id,
    metadata: { fields: Object.keys(payload) },
  });
  return NextResponse.json({ success: true });
}

/** DELETE /api/crm/sales/[id] — exclui venda e itens. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const { data: sale } = await admin.from("crm_sales").select("client_id").eq("id", params.id).eq("tenant_id", tenant!.id).maybeSingle();
  const { error: err } = await admin.from("crm_sales").delete().eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao excluir venda." }, { status: 500 });
  if (sale?.client_id) await autoTimestampSaleMetrics(admin, tenant!.id, sale.client_id);
  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_sale_delete",
    entity_type: "crm_sales",
    entity_id: params.id,
    metadata: {},
  });
  return NextResponse.json({ success: true });
}
