import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** POST /api/crm/clients/[id]/timeline — adiciona evento manual à linha do tempo. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Título do evento é obrigatório." }, { status: 400 });

  const { data, error: err } = await admin
    .from("crm_client_timeline")
    .insert({
      tenant_id: tenant!.id,
      client_id: params.id,
      event_type: body.event_type || "manual",
      title,
      description: body.description || null,
      event_at: body.event_at || new Date().toISOString(),
    })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao adicionar evento." }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_timeline_add",
    entity_type: "crm_client_timeline",
    entity_id: data.id,
    metadata: { client_id: params.id, title },
  });
  return NextResponse.json({ success: true, event: data });
}

/** DELETE /api/crm/clients/[id]/timeline — remove um evento (query ?eventId=). */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "";
  if (!eventId) return NextResponse.json({ error: "Evento não informado." }, { status: 400 });
  const { error: err } = await admin
    .from("crm_client_timeline")
    .delete()
    .eq("id", eventId)
    .eq("tenant_id", tenant!.id)
    .eq("client_id", params.id);
  if (err) return NextResponse.json({ error: "Erro ao remover evento." }, { status: 500 });
  return NextResponse.json({ success: true });
}
