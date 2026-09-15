import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/admin/refunds/reject — Super Admin RECUSA/reverte o pedido de
 * reembolso (ex.: conversou com o usuário no WhatsApp e ele desistiu).
 *
 * O pagamento volta para `succeeded`, o site permanece ativo e a assinatura
 * segue válida (trial + mensalidades). Nada é devolvido no Mercado Pago.
 * O histórico do pedido é preservado em metadata + audit log.
 *
 * Body: { paymentId: string }
 */
export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
  if (!paymentId) return NextResponse.json({ error: "paymentId obrigatório" }, { status: 400 });

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, tenant_id, amount_cents, status, metadata")
    .eq("id", paymentId)
    .eq("type", "activation")
    .maybeSingle();
  const pay = payment as {
    id: string;
    tenant_id: string;
    amount_cents: number;
    status: string;
    metadata: Record<string, unknown> | null;
  } | null;

  if (!pay) return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });

  const awaitingByMeta =
    Boolean(pay.metadata?.refund_requested_at) && !(pay.metadata?.refunded_at);
  if (pay.status !== "refund_pending" && !awaitingByMeta) {
    return NextResponse.json(
      { error: "Este pagamento não está aguardando reembolso." },
      { status: 400 }
    );
  }

  const rejectedAt = new Date().toISOString();
  const { refund_requested_at: _keep, ...restMeta } = (pay.metadata || {}) as Record<string, unknown>;
  void _keep;
  try {
    await admin
      .from("payments")
      .update({
        status: "succeeded",
        metadata: {
          ...restMeta,
          refund_status: "cancelled_by_admin",
          refund_rejected_by: actor.id,
          refund_rejected_at: rejectedAt,
        },
      })
      .eq("id", pay.id);
  } catch (e) {
    console.error("[admin/refunds/reject] falha ao reverter pedido", e);
    return NextResponse.json(
      { error: "Não foi possível reverter o pedido agora." },
      { status: 500 }
    );
  }
  try {
    await admin
      .from("billing_history")
      .update({ status: "succeeded" })
      .eq("tenant_id", pay.tenant_id)
      .like("mercadopago_payment_id", "%:refund_pending");
  } catch {}

  try {
    await admin.from("audit_logs").insert({
      actor_id: actor.id,
      actor_role: "superadmin",
      action: "guarantee.refund_rejected",
      entity_type: "profile",
      entity_id: actor.id,
      metadata: {
        tenant_id: pay.tenant_id,
        payment_id: pay.id,
        amount_cents: pay.amount_cents,
      },
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    status: "succeeded",
    message: "Pedido de reembolso revertido — pagamento segue válido e o site permanece ativo.",
  });
}
