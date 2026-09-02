import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json();
  const { action, note } = body;

  if (!["approve", "reject", "pay"].includes(action)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const admin = createAdminClient();
  const payoutId = params.id;

  const { data: payout } = await admin
    .from("affiliate_payouts")
    .select("*")
    .eq("id", payoutId)
    .maybeSingle();

  if (!payout) {
    return NextResponse.json({ error: "Saque não encontrado" }, { status: 404 });
  }

  let newStatus: string;
  const now = new Date().toISOString();

  if (action === "approve") {
    newStatus = "em_analise";
  } else if (action === "reject") {
    newStatus = "rejeitado";
  } else if (action === "pay") {
    newStatus = "pago";
  } else {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { status: newStatus };
  if (action === "pay") {
    updateData.paid_at = now;
  }

  const { error } = await admin
    .from("affiliate_payouts")
    .update(updateData)
    .eq("id", payoutId);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Log auditoria
  await admin.from("audit_logs").insert({
    actor_id: actor.id,
    actor_role: "superadmin",
    action: `affiliate.payout_${action}`,
    entity_type: "affiliate_payout",
    entity_id: payoutId,
    metadata: { affiliate_user_id: payout.affiliate_user_id, amount: payout.amount, note },
  });

  return NextResponse.json({ success: true });
}