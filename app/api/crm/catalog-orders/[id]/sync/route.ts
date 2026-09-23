import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { grantRaffleCreditsForSale } from "@/lib/crm-raffle";

export const runtime = "nodejs";

/**
 * POST /api/crm/catalog-orders/[id]/sync — converte um pedido PAGO em venda
 * no CRM (entra em Vendas, Relatórios e métricas). Idempotente: se já tem
 * crm_sale_id, retorna a venda existente.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;

  const id = String(params.id || "");
  if (!id) return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });

  try {
    const { data: order } = await admin
      .from("catalog_orders")
      .select("id, payment_status, crm_sale_id")
      .eq("id", id)
      .eq("tenant_id", tenant!.id)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (order.payment_status !== "paid") {
      return NextResponse.json({ error: "Só pedidos pagos podem virar venda no CRM." }, { status: 400 });
    }
    if (order.crm_sale_id) {
      return NextResponse.json({ success: true, saleId: order.crm_sale_id, duplicate: true });
    }

    const { data: saleId, error: rpcErr } = await admin.rpc("create_crm_sale_from_catalog_order", {
      p_order_id: id,
    });
    if (rpcErr) {
      console.error("[catalog-orders] erro ao sincronizar:", rpcErr);
      return NextResponse.json({ error: "Erro ao criar venda no CRM." }, { status: 500 });
    }
    if (saleId) await grantRaffleCreditsForSale(admin, String(saleId));
    return NextResponse.json({ success: true, saleId });
  } catch (e) {
    console.error("[catalog-orders] erro em sync:", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
