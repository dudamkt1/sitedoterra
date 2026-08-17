import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import type { CrmProduct } from "@/types";

export const runtime = "nodejs";

/** GET /api/crm/products — lista produtos do tenant. */
export async function GET(request: Request) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  let query = admin.from("crm_products").select("id, name, description, price_cents, category, image_url, active, created_at, updated_at").eq("tenant_id", tenant!.id);
  if (q) query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%`);
  if (!all) query = query.eq("active", true);
  query = query.order("name", { ascending: true }).limit(1000);

  const { data, error: err } = await query;
  if (err) return NextResponse.json({ error: "Erro ao buscar produtos." }, { status: 500 });

  const products = (data as CrmProduct[]) || [];
  const ids = products.map((p) => p.id);
  const soldMap = new Map<string, { units: number; cents: number }>();
  if (ids.length) {
    const { data: items } = await admin
      .from("crm_sale_items")
      .select("product_id, quantity, total_cents, tenant_id, sale_id")
      .in("product_id", ids)
      .eq("tenant_id", tenant!.id);
    const saleStatuses = new Map<string, string>();
    const saleIds = Array.from(new Set((items || []).map((i) => i.sale_id)));
    if (saleIds.length) {
      const { data: sales } = await admin.from("crm_sales").select("id, status").in("id", saleIds).eq("tenant_id", tenant!.id);
      for (const s of sales || []) saleStatuses.set(s.id, s.status);
    }
    for (const it of items || []) {
      if (saleStatuses.get(it.sale_id) === "Cancelado" || saleStatuses.get(it.sale_id) === "Reembolsado") continue;
      const cur = soldMap.get(it.product_id) || { units: 0, cents: 0 };
      cur.units += it.quantity || 0;
      cur.cents += it.total_cents || 0;
      soldMap.set(it.product_id, cur);
    }
  }
  const enriched = products.map((p) => {
    const s = soldMap.get(p.id);
    return { ...p, units_sold: s?.units || 0, sold_cents: s?.cents || 0 };
  });

  return NextResponse.json({ products: enriched });
}

/** POST /api/crm/products — cria produto. */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nome do produto é obrigatório." }, { status: 400 });

  const { data, error: err } = await admin
    .from("crm_products")
    .insert({
      tenant_id: tenant!.id,
      user_id: user!.id,
      name,
      description: body.description || null,
      price_cents: Math.round(Number(body.price_cents) || 0),
      category: body.category || null,
      image_url: body.image_url || null,
      active: body.active !== false,
    })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao criar produto." }, { status: 500 });
  return NextResponse.json({ success: true, product: data });
}
