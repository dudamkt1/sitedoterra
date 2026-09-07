import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

const DEFAULTS = { reminder_enabled: true, reminder_minutes: 30 };

/** GET /api/bookings/settings — preferência de lembretes do tenant. */
export async function GET() {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const { data, error: err } = await admin
    .from("booking_settings")
    .select("reminder_enabled, reminder_minutes")
    .eq("tenant_id", tenant!.id)
    .maybeSingle();
  if (err) {
    if (err.code === "42P01" || err.message?.includes("booking_settings")) {
      return NextResponse.json({ settings: DEFAULTS, needsSetup: true });
    }
    return NextResponse.json({ error: "Erro ao carregar configurações." }, { status: 500 });
  }
  return NextResponse.json({ settings: data || DEFAULTS });
}

/** PUT /api/bookings/settings — atualiza preferência de lembretes. */
export async function PUT(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json().catch(() => ({}));

  const patch: { reminder_enabled?: boolean; reminder_minutes?: number } = {};
  if (typeof body.reminder_enabled === "boolean") patch.reminder_enabled = body.reminder_enabled;
  if (body.reminder_minutes !== undefined) {
    const minutes = Math.round(Number(body.reminder_minutes));
    if (!minutes || minutes < 5 || minutes > 1440) {
      return NextResponse.json({ error: "Tempo inválido. Use entre 5 e 1440 minutos." }, { status: 400 });
    }
    patch.reminder_minutes = minutes;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  try {
    const { data: existing } = await admin
      .from("booking_settings")
      .select("tenant_id")
      .eq("tenant_id", tenant!.id)
      .maybeSingle();
    if (existing) {
      const { error: err } = await admin
        .from("booking_settings")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenant!.id);
      if (err) return NextResponse.json({ error: "Erro ao salvar." }, { status: 500 });
    } else {
      const { error: err } = await admin.from("booking_settings").insert({
        tenant_id: tenant!.id,
        reminder_enabled: patch.reminder_enabled ?? true,
        reminder_minutes: patch.reminder_minutes ?? 30,
      });
      if (err) return NextResponse.json({ error: "Erro ao salvar." }, { status: 500 });
    }
    await admin.from("audit_logs").insert({
      actor_id: user!.id,
      actor_role: "user",
      action: "booking_settings_update",
      entity_type: "booking_settings",
      entity_id: tenant!.id,
      metadata: patch,
    });
    return NextResponse.json({ success: true, settings: patch });
  } catch (e: any) {
    if (String(e?.message || e).includes("booking_settings") || String(e?.code) === "42P01") {
      return NextResponse.json({ error: "Migration 0043 pendente. Rode a migration no Supabase." }, { status: 501 });
    }
    return NextResponse.json({ error: "Erro ao salvar." }, { status: 500 });
  }
}
