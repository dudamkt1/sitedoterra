import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

const VALID_STATUS = ["pending", "paid", "failed", "refunded", "cancelled"] as const;

/**
 * GET /api/crm/catalog-orders — lista os pagamentos/pedidos do catálogo do tenant.
 * Query: status (pending|paid|failed|refunded|cancelled), q (busca cliente/produto),
 * method (pix|mercadopago|manual), page, perPage.
 * Retorna orders (com product_name), paginação e summary (contagens + valores
 * por status + quantos já viraram venda no CRM).
 */
export async function GET(request: Request) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const method = url.searchParams.get("method") || "";
  const q = (url.searchParams.get("q") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const perPage = Math.min(100, Math.max(5, Number(url.searchParams.get("perPage") || 20)));

  try {
    let query = admin
      .from("catalog_orders")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenant!.id);
    if (status && (VALID_STATUS as readonly string[]).includes(status)) query = query.eq("payment_status", status);
    if (method) query = query.eq("payment_method", method);
    if (q) query = query.ilike("customer_name", `%${q}%`);
    query = query.order("created_at", { ascending: false }).range((page - 1) * perPage, page * perPage - 1);

    const { data: orders, count, error: err } = await query;
    if (err) return NextResponse.json({ error: "Erro ao buscar pagamentos." }, { status: 500 });

    const list = orders || [];
    const productIds = Array.from(new Set(list.map((o) => o.product_id).filter(Boolean)));
    let nameByProduct = new Map<string, string>();
    if (productIds.length) {
      const { data: prods } = await admin
        .from("crm_products")
        .select("id, name")
        .in("id", productIds)
        .eq("tenant_id", tenant!.id);
      nameByProduct = new Map((prods || []).map((p) => [p.id, p.name]));
    }

    // Resumo geral (independe da paginação/filtros de busca — respeita o filtro de status? não: sempre global)
    const { data: all } = await admin
      .from("catalog_orders")
      .select("payment_status, payment_method, final_price_cents, quantity, crm_sale_id")
      .eq("tenant_id", tenant!.id);
    const summary = {
      counts: { pending: 0, paid: 0, failed: 0, refunded: 0, cancelled: 0, total: 0 } as Record<string, number>,
      cents: { pending: 0, paid: 0, failed: 0, refunded: 0, cancelled: 0, total: 0 } as Record<string, number>,
      synced: 0, // pagos já convertidos em venda no CRM
      paidUnsynced: 0,
    };
    for (const o of all || []) {
      const st = String(o.payment_status);
      const total = Math.round(Number(o.final_price_cents) || 0) * Math.max(1, Number(o.quantity) || 1);
      if (st in summary.counts) {
        summary.counts[st] += 1;
        summary.cents[st] += total;
      }
      summary.counts.total += 1;
      summary.cents.total += total;
      if (o.crm_sale_id) summary.synced += 1;
      else if (st === "paid") summary.paidUnsynced += 1;
    }

    return NextResponse.json({
      orders: list.map((o) => ({
        ...o,
        product_name: nameByProduct.get(o.product_id) || o.metadata?.product_name || "Produto",
        total_cents: Math.round(Number(o.final_price_cents) || 0) * Math.max(1, Number(o.quantity) || 1),
      })),
      total: count || 0,
      totalPages: Math.ceil((count || 0) / perPage),
      page,
      perPage,
      summary,
    });
  } catch (e) {
    console.error("[catalog-orders] erro ao listar:", e);
    return NextResponse.json({ error: "Erro interno ao buscar pagamentos." }, { status: 500 });
  }
}
