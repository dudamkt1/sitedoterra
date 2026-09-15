import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/guarantee-cancel/revert — o próprio usuário DESISTE do reembolso
 * antes da devolução ("Cancelar reembolso mantendo meu site ativo").
 *
 * O pagamento volta para `succeeded`, o site permanece ativo e a assinatura
 * segue válida (trial + mensalidades). Nada é devolvido. O admin é avisado
 * via audit log. Só vale enquanto ainda está `refund_pending` (após
 * reembolsado, o caminho é ativar novamente).
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, amount_cents, status, metadata")
    .eq("tenant_id", tenant.id)
    .eq("type", "activation")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pay = payment as {
    id: string;
    amount_cents: number;
    status: string;
    metadata: Record<string, unknown> | null;
  } | null;

  if (!pay) {
    return NextResponse.json({ error: "Nenhum pagamento encontrado." }, { status: 400 });
  }

  const awaitingByMeta =
    Boolean(pay.metadata?.refund_requested_at) && !(pay.metadata?.refunded_at);
  if (pay.status !== "refund_pending" && !awaitingByMeta) {
    return NextResponse.json(
      { error: "Não há pedido de reembolso em andamento para reverter." },
      { status: 400 }
    );
  }

  const revertedAt = new Date().toISOString();
  const { refund_requested_at: _drop, ...restMeta } = (pay.metadata || {}) as Record<string, unknown>;
  void _drop;
  try {
    await admin
      .from("payments")
      .update({
        status: "succeeded",
        metadata: {
          ...restMeta,
          refund_status: "cancelled_by_user",
          refund_reverted_by_user_at: revertedAt,
        },
      })
      .eq("id", pay.id);
  } catch (e) {
    console.error("[guarantee-cancel/revert] falha ao reverter", e);
    return NextResponse.json(
      { error: "Não foi possível reverter agora. Tente novamente." },
      { status: 500 }
    );
  }
  try {
    await admin
      .from("billing_history")
      .update({ status: "succeeded" })
      .eq("tenant_id", tenant.id)
      .like("mercadopago_payment_id", "%:refund_pending");
  } catch {}

  try {
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_role: "user",
      action: "guarantee.refund_reverted_by_user",
      entity_type: "profile",
      entity_id: user.id,
      metadata: { tenant_id: tenant.id, payment_id: pay.id, amount_cents: pay.amount_cents },
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    status: "succeeded",
    message: "Pedido de reembolso cancelado — seu pagamento segue válido e o site permanece ativo.",
  });
}
