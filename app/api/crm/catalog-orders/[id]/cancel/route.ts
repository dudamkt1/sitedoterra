import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/**
 * POST /api/crm/catalog-orders/[id]/cancel — cancela um pedido pendente ou
 * com falha (não mexe em pedidos pagos nem em vendas já criadas no CRM).
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
    if (!["pending", "failed"].includes(String(order.payment_status))) {
      return NextResponse.json({ error: "Só pedidos pendentes ou com falha podem ser cancelados." }, { status: 400 });
    }

    const { error: upErr } = await admin
      .from("catalog_orders")
      .update({ payment_status: "cancelled" })
      .eq("id", id)
      .eq("tenant_id", tenant!.id);
    if (upErr) return NextResponse.json({ error: "Erro ao cancelar pedido." }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[catalog-orders] erro em cancel:", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
