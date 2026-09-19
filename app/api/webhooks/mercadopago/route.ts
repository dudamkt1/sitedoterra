import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMercadoPagoEnabled, verifyMpSignature, getMpPayment } from "@/lib/mercadopago";
import {
  dispatchMpPayment,
  handleMpSubscriptionUpdate,
} from "@/lib/mp-payment-processor";

export const runtime = "nodejs";

/**
 * Webhook do Mercado Pago — FONTE PRINCIPAL de atualização do status financeiro
 * para pagamentos feitos por este gateway (o frontend nunca é fonte de verdade).
 *
 * Notificações: JSON { type: "payment" | "subscription", data: { id }, action }.
 * Idempotência: mesmo padrão do Stripe, via tabela `payment_events`
 * (event_id = `mp_<action>_<data.id>`).
 *
 * A aplicação do estado (aprovado/recusado/reembolsado → banco + ativação)
 * vive em `lib/mp-payment-processor.ts` e é COMPARTILHADA com a sincronização
 * manual (`POST /api/payments/sync`) — que consulta o MP diretamente quando
 * o webhook não foi entregue.
 *
 * Mapa de identificação via `external_reference`:
 *   - "act_<tenantId>" → pagamento ÚNICO de ativação;
 *   - "sub_<tenantId>" → cobrança recorrente da mensalidade;
 *   - "mon_<tenantId>" → mensalidade avulsa paga manualmente (com ou sem crédito).
 *
 * IMPORTANTE: a simples chegada da notificação NÃO é tratada como pagamento
 * aprovado — o pagamento é sempre reconsultado na API do MP (`getMpPayment`)
 * e só `approved` ativa o serviço.
 */
export async function POST(request: Request) {
  if (!(await isMercadoPagoEnabled())) {
    return NextResponse.json({ error: "Mercado Pago não configurado" }, { status: 500 });
  }

  const bodyText = await request.text();
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  const admin = createAdminClient();

  let type: string | null = null;
  let dataId: string | null = null;
  let action: string | null = null;

  // Payload novo (JSON) ou legado (form-urlencoded)
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed && typeof parsed === "object") {
      type = parsed.type || null;
      dataId = parsed.data?.id != null ? String(parsed.data.id) : null;
      action = parsed.action || null;
    }
  } catch {
    // corpo não é JSON → tenta form-urlencoded
  }

  if (!type || !dataId) {
    const params = new URLSearchParams(bodyText);
    type = params.get("type") || params.get("topic");
    dataId = params.get("data.id") || params.get("id");
  }
  if (!type || !dataId) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  if (!(await verifyMpSignature({ xSignature, xRequestId, dataId }))) {
    console.warn("Mercado Pago webhook: assinatura inválida", { xSignature, xRequestId, dataId });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const eventId = `mp_${action || type}_${dataId}`;

  // ---- Idempotência ----
  const { data: inserted, error: insertErr } = await admin
    .from("payment_events")
    .insert({
      gateway: "mercadopago",
      stripe_event_id: eventId,
      stripe_event_type: action || type,
      data: { type, data_id: dataId, action },
    })
    .select("processed_at")
    .maybeSingle();

  if (insertErr) {
    const isDup =
      String(insertErr.message).toLowerCase().includes("duplicate") ||
      String(insertErr.message).toLowerCase().includes("unique");
    if (isDup) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Falha ao registrar evento do MP", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  void inserted;

  try {
    if (type === "payment") {
      // Fonte de verdade: reconsulta o pagamento na API do MP.
      const payment = await getMpPayment(dataId);
      await dispatchMpPayment(payment);

      // Verifica se é um pedido do catálogo
      if (payment.metadata?.catalog_order && payment.external_reference?.startsWith("CATALOG-")) {
        const orderId = payment.external_reference.replace("CATALOG-", "");
        if (payment.status === "approved") {
          // Atualiza o pedido do catálogo
          await admin
            .from("catalog_orders")
            .update({
              payment_status: "paid",
              payment_id: String(payment.id),
              paid_at: new Date().toISOString(),
            })
            .eq("id", orderId);

          // Chama a função para criar venda no CRM
          await admin.rpc("create_crm_sale_from_catalog_order", { p_order_id: orderId });
        } else if (["rejected", "cancelled", "refunded"].includes(payment.status)) {
          await admin
            .from("catalog_orders")
            .update({ payment_status: payment.status === "refunded" ? "refunded" : "failed" })
            .eq("id", orderId);
        }
      }
    } else if (type === "subscription") {
      await handleMpSubscriptionUpdate(dataId);
    }
  } catch (err) {
    await admin.from("payment_events").delete().eq("stripe_event_id", eventId);
    console.error("Mercado Pago webhook: erro ao processar", type, dataId, err);
    return NextResponse.json({ error: "processing_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * Diagnóstico (GET): permite ao Super Admin confirmar que a URL do webhook
 * está acessível e qual gateway está ativo — sem expor segredos.
 */
export async function GET() {
  const enabled = await isMercadoPagoEnabled();
  return NextResponse.json({
    ok: true,
    gateway: "mercadopago",
    configured: enabled,
    timestamp: new Date().toISOString(),
  });
}
