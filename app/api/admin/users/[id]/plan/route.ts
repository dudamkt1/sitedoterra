import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Super Admin altera o plano de um usuário.
 * POST /api/admin/users/[id]/plan  body: { planId }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { planId } = await request.json();
  const admin = createAdminClient();

  const { data: plan } = await admin.from("plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) return NextResponse.json({ error: "Plano inválido" }, { status: 400 });

  const { data: tenant } = await admin.from("tenants").select("id").eq("user_id", params.id).maybeSingle();
  if (!tenant) return NextResponse.json({ error: "Usuário sem tenant" }, { status: 404 });

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub) {
    await admin.from("subscriptions").update({ plan_id: planId }).eq("id", sub.id);
  } else {
    await admin.from("subscriptions").insert({ tenant_id: tenant.id, plan_id: planId, status: "awaiting_activation" });
  }

  await admin.from("audit_logs").insert({
    actor_id: actor.id,
    actor_role: "superadmin",
    action: "subscription.plan_changed",
    entity_type: "subscription",
    entity_id: sub?.id || null,
    metadata: { target_user_id: params.id, plan_id: planId },
  });

  return NextResponse.json({ success: true });
}
