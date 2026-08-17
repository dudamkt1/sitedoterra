import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** PUT /api/crm/tasks/[id] — atualiza tarefa (status, prioridade, etc). */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const payload: Record<string, unknown> = {};
  for (const k of ["title", "due_date", "due_time", "priority", "category", "notes", "client_id"] as const) {
    if (body[k] !== undefined) payload[k] = body[k] === "" ? null : body[k];
  }
  if (body.status !== undefined) {
    payload.status = String(body.status);
    payload.completed_at = body.status === "Concluída" ? new Date().toISOString() : null;
  }
  if (payload.title !== undefined && !String(payload.title).trim()) {
    return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });
  }
  const { error: err } = await admin.from("crm_tasks").update(payload).eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao atualizar tarefa." }, { status: 500 });
  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_task_update",
    entity_type: "crm_tasks",
    entity_id: params.id,
    metadata: { fields: Object.keys(payload) },
  });
  return NextResponse.json({ success: true });
}

/** DELETE /api/crm/tasks/[id] — remove tarefa. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const { error: err } = await admin.from("crm_tasks").delete().eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao excluir tarefa." }, { status: 500 });
  return NextResponse.json({ success: true });
}