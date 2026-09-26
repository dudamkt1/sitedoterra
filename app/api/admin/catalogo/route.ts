import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import {
  MAIN_CATALOG_KEY,
  MAIN_CATALOG_MAX_PRODUCTS,
  normalizeMainCatalog,
} from "@/lib/catalog-main";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Catálogo do domínio principal (Super Admin → /admin/catalogo).
 *
 * GET  → { catalog }  lido de `platform_config.main_catalog`
 * PUT  → salva o documento inteiro (configurações + produtos), normalizado
 *
 * A página pública é `app/catalogo/page.tsx` (https://<domínio>/catalogo).
 * Guardado em `platform_config` para NÃO misturar com os produtos/`crm_products`
 * de cada tenant — o catálogo `/catalogo/[slug]` segue intocado.
 */
async function requireSuperAdmin() {
  const actor = await getCurrentUser();
  if (!actor) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }
  return { actor };
}

async function readCatalog() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", MAIN_CATALOG_KEY)
    .maybeSingle();

  if (error) {
    return { catalog: normalizeMainCatalog(null), error: error.message as string | null };
  }
  return { catalog: normalizeMainCatalog(data?.value ?? null), error: null };
}

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const { catalog, error } = await readCatalog();
  if (error) return NextResponse.json({ error: "Não foi possível carregar o catálogo." }, { status: 500 });
  return NextResponse.json({ catalog });
}

export async function PUT(request: Request) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => null);
  const payload = body && typeof body === "object" && "catalog" in (body as object)
    ? (body as { catalog: unknown }).catalog
    : body;

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const catalog = normalizeMainCatalog(payload);

  if (Array.isArray((payload as { products?: unknown }).products) &&
      (payload as { products: unknown[] }).products.length > MAIN_CATALOG_MAX_PRODUCTS) {
    return NextResponse.json(
      { error: `Máximo de ${MAIN_CATALOG_MAX_PRODUCTS} produtos por catálogo.` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_config")
    .upsert({ key: MAIN_CATALOG_KEY, value: catalog as unknown as Record<string, unknown> }, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar o catálogo." }, { status: 500 });
  }

  return NextResponse.json({ catalog });
}
