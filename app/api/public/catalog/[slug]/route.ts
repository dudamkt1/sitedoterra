import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/public/catalog/[slug]
 * Retorna o catálogo público de um tenant: identidade + produtos
 * ativos marcados como `show_publicly = true`. Sem autenticação.
 */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const slug = String(params.slug || "").toLowerCase();
  if (!slug) return NextResponse.json({ error: "Slug inválido." }, { status: 400 });

  const admin = createAdminClient();
  const { data: tenant, error: tErr } = await admin.rpc("get_public_tenant_by_slug", { p_slug: slug });
  if (tErr) return NextResponse.json({ error: "Tenant não encontrado." }, { status: 404 });
  const t = (Array.isArray(tenant) ? tenant[0] : tenant) as
    | { tenant_id: string; slug: string; site_name: string | null; site_status: string; email: string; profile_name: string | null }
    | null;
  if (!t) return NextResponse.json({ error: "Catálogo não encontrado." }, { status: 404 });
  if (t.site_status !== "active") {
    return NextResponse.json({ error: "Site indisponível." }, { status: 403 });
  }

  // Produtos públicos do tenant.
  const { data: products, error: pErr } = await admin
    .from("crm_products")
    .select("id, name, description, price_cents, category, image_url, unit")
    .eq("tenant_id", t.tenant_id)
    .eq("active", true)
    .eq("show_publicly", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (pErr) {
    return NextResponse.json({ error: "Erro ao buscar catálogo." }, { status: 500 });
  }

  return NextResponse.json({
    tenant: {
      slug: t.slug,
      site_name: t.site_name,
      profile_name: t.profile_name,
    },
    products: products || [],
  });
}
