import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

const ALLOWED = ["pendente", "confirmado", "realizado", "cancelado", "faltou", "reagendado"] as const;

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const id = params.id;
  const body = await request.json();

  const patch: Record<string, unknown> = {};
  if (typeof body.client_name === "string" && body.client_name.trim()) patch.client_name = body.client_name.trim();
  if (typeof body.client_whatsapp === "string") patch.client_whatsapp = body.client_whatsapp.replace(/\D/g, "") || null;
  if (typeof body.client_email === "string") patch.client_email = body.client_email.trim() || null;
  if (typeof body.client_phone === "string") patch.client_phone = body.client_phone.trim() || null;
  if (typeof body.booking_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.booking_date)) patch.booking_date = body.booking_date;
  if (typeof body.booking_time === "string" && /^\d{2}:\d{2}$/.test(body.booking_time)) patch.booking_time = body.booking_time;
  if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;
  if (typeof body.status === "string" && (ALLOWED as readonly string[]).includes(body.status)) patch.status = body.status;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });

  const { data, error: err } = await admin.from("tenant_bookings").update(patch).eq("id", id).eq("tenant_id", tenant!.id).select().single();
  if (err) return NextResponse.json({ error: "Erro ao atualizar agendamento." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
  return NextResponse.json({ booking: data });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const id = params.id;
  const { error: err } = await admin.from("tenant_bookings").delete().eq("id", id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao excluir." }, { status: 500 });
  return NextResponse.json({ success: true });
}
