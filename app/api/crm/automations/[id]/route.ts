import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** PUT /api/crm/automations/[id] — atualiza automação. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const payload: Record<string, unknown> = {};
  for (const k of ["type", "days", "schedule_time", "message"] as const) {
    if (body[k] !== undefined) payload[k] = body[k];
  }
  if (body.enabled !== undefined) payload.enabled = Boolean(body.enabled);
  const { error: err } = await admin.from("crm_automations").update(payload).eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao atualizar automação." }, { status: 500 });
  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_automation_update",
    entity_type: "crm_automations",
    entity_id: params.id,
    metadata: { fields: Object.keys(payload) },
  });
  return NextResponse.json({ success: true });
}

/** DELETE /api/crm/automations/[id] — remove automação. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const { error: err } = await admin.from("crm_automations").delete().eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao excluir automação." }, { status: 500 });
  return NextResponse.json({ success: true });
}