import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { getCrmSettings, getLoyaltySettings, attachClientMetrics, clientLevel } from "@/lib/crm";
import type { CrmClient } from "@/types";

export const runtime = "nodejs";

/** GET /api/crm/clients/[id] — ficha completa do cliente. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const id = params.id;

  const [{ data: client }, { data: sales }, { data: timeline }, { data: notes }, { data: charges }, { data: tasks }, { data: points }, { data: products }] =
    await Promise.all([
      admin.from("crm_clients").select("*").eq("id", id).eq("tenant_id", tenant!.id).maybeSingle(),
      admin.from("crm_sales").select("*").eq("client_id", id).eq("tenant_id", tenant!.id).order("sale_date", { ascending: false }).limit(200),
      admin.from("crm_client_timeline").select("*").eq("client_id", id).eq("tenant_id", tenant!.id).order("event_at", { ascending: false }).limit(100),
      admin.from("crm_client_notes").select("*").eq("client_id", id).eq("tenant_id", tenant!.id).order("created_at", { ascending: false }).limit(100),
      admin.from("crm_charges").select("*").eq("client_id", id).eq("tenant_id", tenant!.id).order("due_date", { ascending: false }).limit(100),
      admin.from("crm_tasks").select("*").eq("client_id", id).eq("tenant_id", tenant!.id).order("due_date", { ascending: true }).limit(100),
      admin.from("crm_loyalty_points").select("*").eq("client_id", id).eq("tenant_id", tenant!.id).order("created_at", { ascending: false }).limit(200),
      admin.from("crm_products").select("id, name, image_url, price_cents").eq("tenant_id", tenant!.id).eq("active", true).limit(100),
    ]);

  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const [enriched] = await attachClientMetrics(admin, tenant!.id, [client as CrmClient]);
  const settings = await getCrmSettings(admin, tenant!.id);
  const loyalty = await getLoyaltySettings(admin, tenant!.id);
  const pointsBalance = (points || []).reduce((s, p) => s + (p.amount || 0), 0);

  return NextResponse.json({
    client: { ...enriched, points_balance: pointsBalance },
    sales,
    timeline,
    notes,
    charges,
    tasks,
    points,
    products,
    settings,
    level: clientLevel({ ...enriched, points_balance: pointsBalance }, loyalty.levels),
    levels: loyalty.levels,
  });
}

/** PUT /api/crm/clients/[id] — atualiza cliente. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const allowed = [
    "name", "cpf", "birth_date", "email", "phone", "whatsapp", "city", "state", "notes",
    "category", "is_vip", "first_contact_at", "last_contact_at",
  ];
  const payload: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) payload[k] = body[k];
  }
  if (payload.name !== undefined && !String(payload.name).trim()) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }
  const { error: err } = await admin.from("crm_clients").update(payload).eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao atualizar cliente." }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_client_update",
    entity_type: "crm_clients",
    entity_id: params.id,
    metadata: { fields: Object.keys(payload) },
  });
  return NextResponse.json({ success: true });
}

/** DELETE /api/crm/clients/[id] — exclui definitivamente o cliente (com confirmação no frontend). */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const { data: client } = await admin.from("crm_clients").select("name").eq("id", params.id).eq("tenant_id", tenant!.id).maybeSingle();
  const { error: err } = await admin.from("crm_clients").delete().eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao excluir cliente." }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_client_delete",
    entity_type: "crm_clients",
    entity_id: params.id,
    metadata: { name: client?.name },
  });
  return NextResponse.json({ success: true });
}
