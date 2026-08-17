import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** GET /api/crm/messages — mensagens prontas do usuário. */
export async function GET() {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const { data, error: err } = await admin.from("crm_message_templates").select("*").eq("tenant_id", tenant!.id).order("label", { ascending: true });
  if (err) return NextResponse.json({ error: "Erro ao buscar mensagens." }, { status: 500 });
  return NextResponse.json({ messages: data || [] });
}

/** POST /api/crm/messages — cria/atualiza mensagem pronta. */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!label || !message) return NextResponse.json({ error: "Rótulo e mensagem são obrigatórios." }, { status: 400 });

  if (body.id) {
    const { error: err } = await admin.from("crm_message_templates").update({ label, message, code: body.code || null }).eq("id", body.id).eq("tenant_id", tenant!.id);
    if (err) return NextResponse.json({ error: "Erro ao atualizar mensagem." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { data, error: err } = await admin
    .from("crm_message_templates")
    .insert({ tenant_id: tenant!.id, user_id: user!.id, code: body.code || null, label, message })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao salvar mensagem." }, { status: 500 });
  return NextResponse.json({ success: true, message: data });
}