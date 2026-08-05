import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Cria/atualiza planos (Super Admin).
 * POST /api/admin/plans
 */
export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json();
  const admin = createAdminClient();

  const payload = {
    name: body.name,
    code: body.code,
    description: body.description || null,
    activation_price_cents: Math.max(0, Math.round(Number(body.activation_price_cents) || 0)),
    monthly_price_cents: Math.max(0, Math.round(Number(body.monthly_price_cents) || 0)),
    billing_interval: body.billing_interval === "year" ? "year" : "month",
    is_active: Boolean(body.is_active),
  };

  if (body.id) {
    const { error } = await admin.from("plans").update(payload).eq("id", body.id);
    if (error) return NextResponse.json({ error: "Erro ao atualizar plano" }, { status: 500 });
  } else {
    const { error } = await admin.from("plans").insert(payload);
    if (error) return NextResponse.json({ error: "Erro ao criar plano" }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    actor_id: actor.id,
    actor_role: "superadmin",
    action: body.id ? "plan.updated" : "plan.created",
    entity_type: "plan",
    entity_id: body.id || body.code,
    metadata: { ...payload },
  });

  return NextResponse.json({ success: true });
}
