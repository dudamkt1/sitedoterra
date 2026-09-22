import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { getMpPayment, getMpPaymentWithToken } from "@/lib/mercadopago";
import { resolveGateways } from "@/lib/gateway-config";

export const runtime = "nodejs";

/**
 * POST /api/crm/catalog-orders/[id]/refresh — reconsulta o status real no
 * Mercado Pago (fonte de verdade) e atualiza o pedido. Se aprovado, cria a
 * venda no CRM automaticamente.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;

  const id = String(params.id || "");
  if (!id) return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });

  try {
    const { data: order } = await admin
      .from("catalog_orders")
      .select("id, payment_id, payment_status, payment_method, crm_sale_id")
      .eq("id", id)
      .eq("tenant_id", tenant!.id)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (!order.payment_id) {
      return NextResponse.json({ error: "Pedido ainda sem cobrança no Mercado Pago." }, { status: 400 });
    }
    if (order.payment_method === "manual") {
      return NextResponse.json({ error: "Pedido manual: atualize o status pela venda no CRM." }, { status: 400 });
    }

    // Token: prefere a conta do dono do catálogo (pagamentos caem nela).
    const { data: settings } = await admin
      .from("catalog_payment_settings")
      .select("mp_access_token")
      .eq("tenant_id", tenant!.id)
      .maybeSingle();
    const tenantToken = (settings as { mp_access_token: string | null } | null)?.mp_access_token;
    const gateways = await resolveGateways();
    const globalToken = gateways.mercadopago.accessToken;

    let payment: Awaited<ReturnType<typeof getMpPayment>>;
    try {
      payment = tenantToken
        ? await getMpPaymentWithToken(String(order.payment_id), tenantToken)
        : await getMpPayment(String(order.payment_id));
    } catch (e) {
      // Se o token do tenant falhar, tenta o global antes de desistir.
      if (tenantToken && globalToken && tenantToken !== globalToken) {
        payment = await getMpPayment(String(order.payment_id));
      } else {
        throw e;
      }
    }

    const st = String(payment.status || "");
    if (st === "approved") {
      await admin
        .from("catalog_orders")
        .update({
          payment_status: "paid",
          payment_id: String(payment.id),
          paid_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (!order.crm_sale_id) {
        await admin.rpc("create_crm_sale_from_catalog_order", { p_order_id: id });
      }
    } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(st)) {
      await admin
        .from("catalog_orders")
        .update({ payment_status: st === "refunded" || st === "charged_back" ? "refunded" : "failed" })
        .eq("id", id);
    } else {
      // pending / in_process / authorized / in_mediation: mantém pendente
      await admin.from("catalog_orders").update({ payment_status: "pending" }).eq("id", id);
    }

    return NextResponse.json({ success: true, mpStatus: st });
  } catch (e) {
    console.error("[catalog-orders] erro em refresh:", e);
    return NextResponse.json({ error: "Não foi possível consultar o Mercado Pago agora." }, { status: 502 });
  }
}
