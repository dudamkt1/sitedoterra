import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** GET /api/crm/automations — lista automações. */
export async function GET() {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const { data, error: err } = await admin.from("crm_automations").select("*").eq("tenant_id", tenant!.id).order("type", { ascending: true });
  if (err) return NextResponse.json({ error: "Erro ao buscar automações." }, { status: 500 });
  return NextResponse.json({ automations: data || [] });
}

/** POST /api/crm/automations — cria automação. */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const type = typeof body.type === "string" ? body.type : "";
  if (!type) return NextResponse.json({ error: "Tipo de automação é obrigatório." }, { status: 400 });

  const { data, error: err } = await admin
    .from("crm_automations")
    .insert({
      tenant_id: tenant!.id,
      user_id: user!.id,
      type,
      enabled: body.enabled !== false,
      days: Math.round(Number(body.days) || 0),
      schedule_time: body.schedule_time || null,
      message: body.message || null,
    })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao criar automação." }, { status: 500 });
  return NextResponse.json({ success: true, automation: data });
}