import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mediaContext, MediaError, toMediaView } from "@/lib/media";

export const runtime = "nodejs";

/**
 * GET /api/media?scope=tenant|system|admin&category=&q=&sort=&tenant_id=
 * Lista mídias com isolamento multi-tenant:
 *   - scope=tenant (padrão): apenas os arquivos do tenant do usuário autenticado.
 *   - scope=system: apenas arquivos do sistema (tenant_id null) — Super Admin.
 *   - scope=admin: tudo — Super Admin (aceita tenant_id para filtrar um usuário).
 */
export async function GET(request: Request) {
  const admin = createAdminClient();

  let ctx;
  try {
    ctx = await mediaContext();
  } catch (err) {
    if (err instanceof MediaError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") || "tenant";
  const category = url.searchParams.get("category");
  const q = url.searchParams.get("q");
  const sort = url.searchParams.get("sort") || "newest";
  const tenantId = url.searchParams.get("tenant_id");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 60, 1), 200);

  let query = admin.from("media_files").select("*");

  if (scope === "admin" || scope === "system") {
    if (!ctx.isSuperAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
  }

  if (scope === "tenant") {
    query = query.eq("tenant_id", ctx.tenant.id).eq("status", "uploaded");
  } else if (scope === "system") {
    query = query.is("tenant_id", null).eq("status", "uploaded");
  } else if (scope === "admin") {
    query = query.eq("status", "uploaded");
    if (tenantId) query = query.eq("tenant_id", tenantId);
  }

  if (category) query = query.eq("category", category);
  if (q && q.trim()) {
    const needle = q.trim();
    query = query.or(`original_name.ilike.%${needle}%,file_name.ilike.%${needle}%`);
  }

  switch (sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "largest":
      query = query.order("file_size", { ascending: false });
      break;
    case "smallest":
      query = query.order("file_size", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query.limit(limit);
  if (error) {
    console.error("Erro ao listar mídias", error);
    return NextResponse.json({ error: "Erro ao listar mídias" }, { status: 500 });
  }

  let items = (data || []).map(toMediaView);

  // Enriquecimento p/ Super Admin (visualizar proprietário) quando scope=admin.
  if (scope === "admin" && items.length > 0) {
    const ownerIds = Array.from(new Set(items.map((m) => m.user_id)));
    const tenantIds = Array.from(new Set(items.map((m) => m.tenant_id).filter(Boolean) as string[]));
    const [{ data: tenants }, { data: owners }] = await Promise.all([
      tenantIds.length
        ? admin.from("tenants").select("id, slug, site_name").in("id", tenantIds)
        : Promise.resolve({ data: [] }),
      admin.from("profiles").select("user_id, name, email").in("user_id", ownerIds),
    ]);
    const tmap = new Map((tenants || []).map((t) => [t.id, t]));
    const omap = new Map((owners || []).map((p) => [p.user_id, p]));
    items = items.map((m) => ({
      ...m,
      tenant_name: m.tenant_id ? (tmap.get(m.tenant_id)?.site_name ?? null) : null,
      tenant_slug: m.tenant_id ? (tmap.get(m.tenant_id)?.slug ?? null) : "Sistema",
      owner_name: omap.get(m.user_id)?.name ?? null,
      owner_email: omap.get(m.user_id)?.email ?? null,
    }));
  }

  return NextResponse.json({ items, total: items.length, scope });
}