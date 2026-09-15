import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { refundMpPayment } from "@/lib/mercadopago";
import { handleMpRefund } from "@/lib/mp-payment-processor";

export const runtime = "nodejs";

/**
 * POST /api/admin/refunds/authorize — Super Admin AUTORIZA o reembolso.
 *
 * Somente após esta autorização o sistema emite a devolução no Mercado Pago
 * (antes disso o pedido fica em `refund_pending` para o admin conversar com
 * o usuário e tentar reverter). Assim que o MP aceita, a baixa é aplicada NA
 * HORA (pagamento → reembolsado, site desativado) — sem esperar o webhook —
 * para impedir duplo reembolso (novo clique encontra `refunded` e é barrado).
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
    .select("id, tenant_id, amount_cents, status, mercadopago_payment_id, metadata")
    .eq("id", paymentId)
    .eq("type", "activation")
    .maybeSingle();
  const pay = payment as {
    id: string;
    tenant_id: string;
    amount_cents: number;
    status: string;
    mercadopago_payment_id: string | null;
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
  if (pay.status === "refunded") {
    return NextResponse.json({ ok: true, status: "refunded", message: "Já reembolsado." });
  }
  if (!pay.mercadopago_payment_id) {
    return NextResponse.json(
      { error: "Pagamento sem referência do Mercado Pago." },
      { status: 400 }
    );
  }
  const mpNum = Number(pay.mercadopago_payment_id);
  if (!Number.isFinite(mpNum)) {
    return NextResponse.json(
      { error: "Referência do Mercado Pago inválida." },
      { status: 400 }
    );
  }

  let refundStatus = "authorized";
  try {
    const refund = await refundMpPayment(pay.mercadopago_payment_id);
    refundStatus = String(refund?.status || "authorized");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // Já devolvido no MP: segue o fluxo (o sync/webhook reflete o estado).
    if (/already|refund/i.test(msg) && /refund/i.test(msg)) {
      refundStatus = "already_refunded";
    } else {
      console.error("[admin/refunds/authorize] falha no reembolso MP", e);
      return NextResponse.json(
        { error: "Não foi possível processar a devolução no Mercado Pago agora. Tente novamente." },
        { status: 502 }
      );
    }
  }

  const authorizedAt = new Date().toISOString();
  try {
    await admin
      .from("payments")
      .update({
        metadata: {
          ...(pay.metadata || {}),
          refund_status: refundStatus,
          refund_authorized_by: actor.id,
          refund_authorized_at: authorizedAt,
        },
      })
      .eq("id", pay.id);
  } catch {}

  try {
    await admin.from("audit_logs").insert({
      actor_id: actor.id,
      actor_role: "superadmin",
      action: "guarantee.refund_authorized",
      entity_type: "profile",
      entity_id: actor.id,
      metadata: {
        tenant_id: pay.tenant_id,
        payment_id: pay.id,
        mp_payment_id: pay.mercadopago_payment_id,
        amount_cents: pay.amount_cents,
        refund_status: refundStatus,
      },
    });
  } catch {}

  // Baixa IMEDIATA (não espera o webhook): pagamento → reembolsado, site
  // desativado, assinaturas canceladas. Novo clique em "Autorizar" encontra
  // `refunded` e é barrado — impossível reembolsar 2x. O webhook do MP segue
  // idempotente como redundância.
  try {
    await handleMpRefund({
      id: mpNum,
      status: "refunded",
      external_reference: `act_${pay.tenant_id}`,
      transaction_amount: (pay.amount_cents || 0) / 100,
      currency_id: "brl",
      date_approved: null,
      date_created: new Date().toISOString(),
      preference_id: null,
      metadata: { tenant_id: pay.tenant_id, type: "activation" },
    });
  } catch (e) {
    console.error("[admin/refunds/authorize] falha na baixa imediata (webhook cobre)", e);
  }

  return NextResponse.json({
    ok: true,
    status: "refunded",
    refund_status: refundStatus,
    message:
      "Reembolso autorizado e enviado — sistema atualizado para reembolsado e site desativado.",
  });
}
