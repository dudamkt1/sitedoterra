import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import type { TenantBooking } from "@/types";

export const runtime = "nodejs";

const ALLOWED_STATUSES = ["pendente", "confirmado", "realizado", "cancelado", "faltou", "reagendado"] as const;

/** GET /api/bookings — lista agendamentos do tenant, ordenados por data/hora. */
export async function GET(request: Request) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";

  let query = admin.from("tenant_bookings").select("*").eq("tenant_id", tenant!.id).order("booking_date", { ascending: true }).order("booking_time", { ascending: true }).limit(500);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("booking_date", from);
  if (to) query = query.lte("booking_date", to);

  const { data, error: err } = await query;
  if (err) {
    // tabela pode ainda não existir (migration não rodada) — retorna vazio sem quebrar painel
    if (err.message?.includes("tenant_bookings") || err.code === "42P01") {
      return NextResponse.json({ bookings: [] });
    }
    return NextResponse.json({ error: "Erro ao buscar agendamentos." }, { status: 500 });
  }
  const bookings = (data as TenantBooking[]) || [];
  // próximos primeiro, mas já ordenado; destaca pendentes/confirmados no topo
  return NextResponse.json({ bookings });
}

/** POST /api/bookings — cria agendamento. */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();

  const client_name = typeof body.client_name === "string" ? body.client_name.trim() : "";
  const booking_date = typeof body.booking_date === "string" ? body.booking_date.trim() : "";
  const booking_time = typeof body.booking_time === "string" ? body.booking_time.trim() : "";
  if (!client_name) return NextResponse.json({ error: "Nome do cliente é obrigatório." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) return NextResponse.json({ error: "Data inválida. Use YYYY-MM-DD." }, { status: 400 });
  if (!/^\d{2}:\d{2}$/.test(booking_time)) return NextResponse.json({ error: "Horário inválido. Use HH:mm." }, { status: 400 });

  const status = ALLOWED_STATUSES.includes(body.status) ? body.status : "pendente";
  const whatsappRaw = typeof body.client_whatsapp === "string" ? body.client_whatsapp.replace(/\D/g, "") : null;
  const payload = {
    tenant_id: tenant!.id,
    user_id: user!.id,
    client_name,
    client_whatsapp: whatsappRaw || null,
    client_email: typeof body.client_email === "string" ? body.client_email.trim() || null : null,
    client_phone: typeof body.client_phone === "string" ? body.client_phone.trim() || null : null,
    booking_date,
    booking_time,
    notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    status,
    source: "painel",
  };

  const { data, error: err } = await admin.from("tenant_bookings").insert(payload).select().single();
  if (err) {
    if (err.code === "42P01") return NextResponse.json({ error: "Tabela de agendamentos ainda não criada. Rode as migrations." }, { status: 500 });
    return NextResponse.json({ error: "Erro ao criar agendamento." }, { status: 500 });
  }
  return NextResponse.json({ booking: data });
}
