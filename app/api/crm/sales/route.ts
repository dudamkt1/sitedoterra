import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { getLoyaltySettings, autoTimestampSaleMetrics, getCrmSettings, applyVipRules } from "@/lib/crm";
import type { CrmSale } from "@/types";

export const runtime = "nodejs";

/** GET /api/crm/sales — lista vendas com filtros. */
export async function GET(request: Request) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const status = url.searchParams.get("status") || "";
  const clientId = url.searchParams.get("clientId") || "";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const perPage = Math.min(100, Math.max(5, Number(url.searchParams.get("perPage") || 25)));

  let query = admin.from("crm_sales").select("*").eq("tenant_id", tenant!.id);
  if (from) query = query.gte("sale_date", from);
  if (to) query = query.lte("sale_date", to);
  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  query = query.order("sale_date", { ascending: false }).order("created_at", { ascending: false }).range((page - 1) * perPage, page * perPage - 1);

  const [{ data, count, error: err }, { data: totalRes }] = await Promise.all([
    query,
    admin.from("crm_sales").select("id", { count: "exact", head: true }).eq("tenant_id", tenant!.id),
  ]);
  if (err) return NextResponse.json({ error: "Erro ao buscar vendas." }, { status: 500 });

  const sales = (data as CrmSale[]) || [];
  const clientIds = Array.from(new Set(sales.map((s) => s.client_id).filter(Boolean) as string[]));
  const { data: clients } = clientIds.length ? await admin.from("crm_clients").select("id, name").in("id", clientIds).eq("tenant_id", tenant!.id) : { data: [] };
  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));

  const saleIds = sales.map((s) => s.id);
  const { data: items } = saleIds.length ? await admin.from("crm_sale_items").select("*").in("sale_id", saleIds).eq("tenant_id", tenant!.id) : { data: [] };
  const itemsBySale = new Map<string, typeof items>();
  for (const it of items || []) {
    const arr = itemsBySale.get(it.sale_id) || [];
    arr.push(it);
    itemsBySale.set(it.sale_id, arr);
  }

  return NextResponse.json({
    sales: sales.map((s) => ({
      ...s,
      client_name: s.client_id ? nameById.get(s.client_id) || null : null,
      items: itemsBySale.get(s.id) || [],
    })),
    total: count || 0,
    totalPages: Math.ceil((count || 0) / perPage),
    page,
    perPage,
  });
}

/** POST /api/crm/sales — registra venda com itens, atualiza métricas, fidelidade e timeline. */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();

  const clientId = typeof body.client_id === "string" ? body.client_id : null;
  if (clientId) {
    const { data: c } = await admin.from("crm_clients").select("id").eq("id", clientId).eq("tenant_id", tenant!.id).maybeSingle();
    if (!c) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 400 });
  }

  const rawItems: any[] = Array.isArray(body.items) ? (body.items as any[]) : [];
  const items: { product_id: string | null; product_name: string; quantity: number; unit_price_cents: number; total_cents: number }[] = rawItems
    .map((it: any) => ({
      product_id: it.product_id || null,
      product_name: it.product_name ? String(it.product_name).trim() : "Produto avulso",
      quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
      unit_price_cents: Math.round(Number(it.unit_price_cents) || 0),
    }))
    .map((it) => ({ ...it, total_cents: it.quantity * it.unit_price_cents }))
    .filter((it) => it.total_cents > 0);

  const subtotal = items.reduce((s, it) => s + it.total_cents, 0);
  const discount = Math.min(Math.max(0, Math.round(Number(body.discount_cents) || 0)), subtotal);
  const total = subtotal - discount;

  const { data: sale, error: err } = await admin
    .from("crm_sales")
    .insert({
      tenant_id: tenant!.id,
      user_id: user!.id,
      client_id: clientId,
      sale_date: body.sale_date || new Date().toISOString().slice(0, 10),
      discount_cents: discount,
      total_cents: total,
      payment_method: body.payment_method || null,
      status: body.status || "Pago",
      notes: body.notes || null,
    })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao registrar venda." }, { status: 500 });

  if (items.length) {
    const rows = items.map((it: any) => ({
      tenant_id: tenant!.id,
      sale_id: sale.id,
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_price_cents: it.unit_price_cents,
      total_cents: it.total_cents,
    }));
    const { error: itemErr } = await admin.from("crm_sale_items").insert(rows);
    if (itemErr) return NextResponse.json({ error: "Erro ao salvar itens da venda." }, { status: 500 });
  }

  if (clientId) {
    await autoTimestampSaleMetrics(admin, tenant!.id, clientId);
    await admin.from("crm_client_timeline").insert({
      tenant_id: tenant!.id,
      client_id: clientId,
      event_type: "compra",
      title: `Compra registrada — ${(total / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      description: body.notes || (items.length ? `Produtos: ${items.map((i: any) => i.product_name).join(", ")}` : null),
      event_at: sale.sale_date ? `${sale.sale_date}T12:00:00Z` : new Date().toISOString(),
    });

    // Pontos de fidelidade por compra (se o programa estiver ativo)
    const loyalty = await getLoyaltySettings(admin, tenant!.id);
    if (loyalty.enabled && (sale.status === "Pago" || sale.status === "Parcial")) {
      const points = Math.floor((total / 100) * (loyalty.points_per_purchase_cents / 100));
      if (points > 0) {
        await admin.from("crm_loyalty_points").insert({
          tenant_id: tenant!.id,
          client_id: clientId,
          amount: points,
          type: "compra",
          description: `Compra de ${(total / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        });
        await admin.from("crm_client_timeline").insert({
          tenant_id: tenant!.id,
          client_id: clientId,
          event_type: "beneficio",
          title: `+${points} pontos de fidelidade`,
          description: "Pontos por compra",
          event_at: new Date().toISOString(),
        });
      }
    }

    const settings = await getCrmSettings(admin, tenant!.id);
    await applyVipRules(admin, tenant!.id, settings);
  }

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_sale_create",
    entity_type: "crm_sales",
    entity_id: sale.id,
    metadata: { total_cents: total, items: items.length },
  });

  return NextResponse.json({ success: true, sale });
}
