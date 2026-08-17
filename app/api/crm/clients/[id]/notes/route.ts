import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** POST /api/crm/clients/[id]/notes — adiciona anotação ao cliente. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note) return NextResponse.json({ error: "Anotação vazia." }, { status: 400 });

  const { data, error: err } = await admin
    .from("crm_client_notes")
    .insert({
      tenant_id: tenant!.id,
      client_id: params.id,
      user_id: user!.id,
      note,
    })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao salvar anotação." }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_note_add",
    entity_type: "crm_client_notes",
    entity_id: data.id,
    metadata: { client_id: params.id },
  });
  return NextResponse.json({ success: true, note: data });
}

/** DELETE /api/crm/clients/[id]/notes — remove anotação (?noteId=). */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const url = new URL(request.url);
  const noteId = url.searchParams.get("noteId") || "";
  if (!noteId) return NextResponse.json({ error: "Anotação não informada." }, { status: 400 });
  const { error: err } = await admin
    .from("crm_client_notes")
    .delete()
    .eq("id", noteId)
    .eq("tenant_id", tenant!.id)
    .eq("client_id", params.id);
  if (err) return NextResponse.json({ error: "Erro ao remover anotação." }, { status: 500 });
  return NextResponse.json({ success: true });
}
