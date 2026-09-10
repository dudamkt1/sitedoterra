import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getOfficialHomeTenant, invalidateOfficialHomeCache } from "@/lib/site-official";
import { getPublicTenantBySlug, getPublicTenantByDomain } from "@/lib/tenant";
import { getPublicBaseUrl } from "@/lib/public-url";

export const runtime = "nodejs";

/**
 * "Informações do site" do SITE OFICIAL (Super Admin → /admin/editor-home).
 *
 * Espelha o card "Informações do site" do painel (SiteManager), mas grava no
 * tenant oficial da plataforma (o mesmo exibido na HOME `/`) em vez de no
 * tenant do usuário logado.
 *
 * GET  → { tenant: { id, slug }, siteData } (site_settings.data do oficial)
 * POST → mescla os campos de conteúdo permitidos (mesma lista do /api/site)
 *        e invalida os caches da home.
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

/** Mesmos campos de conteúdo do card "Informações do site" do painel. */
const ALLOWED_KEYS = [
  "name",
  "surname",
  "fullName",
  "role",
  "eyebrow",
  "description",
  "badgeTitle",
  "badgeSubtitle",
  "whatsapp",
  "whatsapp_floating_enabled",
  "email",
  "instagram",
  "instagramHandle",
  "stats",
] as const;

/** Hostname do domínio principal (ex.: oleos.topconsultores.com.br). */
function mainDomainHostname(): string | null {
  try {
    const host = new URL(getPublicBaseUrl()).hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === "localhost" || host.endsWith(".vercel.app")) return null;
    return host;
  } catch {
    return null;
  }
}

async function resolveTenantRow(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string | null | undefined
) {
  if (!tenantId || tenantId === "index") return null;
  const { data: row } = await admin
    .from("tenants")
    .select("id, slug")
    .eq("id", tenantId)
    .maybeSingle();
  return (row as { id: string; slug: string } | null) || null;
}

async function resolveOfficialTenantId(admin: ReturnType<typeof createAdminClient>) {
  const host = mainDomainHostname();

  // 1) Tenant OFICIAL — exatamente o que o domínio principal renderiza na
  //    HOME `/` (app/page.tsx → getOfficialHomeTenant). O RPC pode retornar
  //    `id` em vez de `tenant_id` — aceitar ambos.
  try {
    const official = (await getOfficialHomeTenant()) as unknown as Record<string, unknown>;
    const tid = (official?.tenant_id as string) || (official?.id as string) || null;
    const row = await resolveTenantRow(admin, tid);
    if (row) return { ...row, domain: host, source: "official" as const };
  } catch {
    // tenta as próximas estratégias
  }

  // 2) Slug da HOME (HOME_TENANT_SLUG) — mesma fonte de /login e /checkout.
  const homeSlug = process.env.HOME_TENANT_SLUG || "usuarioteste";
  try {
    const bySlug = await getPublicTenantBySlug(homeSlug);
    const row = await resolveTenantRow(admin, bySlug?.tenant_id);
    if (row) return { ...row, domain: host, source: "slug" as const };
  } catch {
    // tenta a próxima estratégia
  }

  // 3) Domínio principal (ex.: oleos.topconsultores.com.br).
  if (host) {
    try {
      const byDomain = await getPublicTenantByDomain(host);
      const row = await resolveTenantRow(admin, byDomain?.tenant_id);
      if (row) return { ...row, domain: host, source: "domain" as const };
    } catch {
      // sem mais estratégias
    }
  }

  console.warn("[admin/home-site] nenhum tenant oficial resolvido", { homeSlug, host });
  return null;
}

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;
  const admin = createAdminClient();

  const tenant = await resolveOfficialTenantId(admin);
  if (!tenant) {
    return NextResponse.json({ error: "Site oficial não encontrado." }, { status: 404 });
  }

  const { data: settings } = await admin
    .from("site_settings")
    .select("data")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  return NextResponse.json({
    tenant: { id: tenant.id, slug: tenant.slug, domain: tenant.domain || null, source: tenant.source },
    siteData: (settings?.data as Record<string, unknown>) || {},
  });
}

export async function POST(request: Request) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;
  const admin = createAdminClient();

  const tenant = await resolveOfficialTenantId(admin);
  if (!tenant) {
    return NextResponse.json({ error: "Site oficial não encontrado." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Sanitiza: mantém apenas as chaves do card (igual ao /api/site do painel).
  const data: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in body) data[key] = body[key];
  }
  if (typeof data.whatsapp === "string") {
    data.whatsapp = data.whatsapp.replace(/[^\d]/g, "");
  }

  const { data: existing } = await admin
    .from("site_settings")
    .select("data")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const merged = { ...((existing?.data as Record<string, unknown>) || {}), ...data };

  const { error } = await admin
    .from("site_settings")
    .upsert({ tenant_id: tenant.id, data: merged }, { onConflict: "tenant_id" });

  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar as informações." }, { status: 500 });
  }

  invalidateOfficialHomeCache();
  try {
    revalidatePath("/");
  } catch {
    // best-effort
  }

  return NextResponse.json({ success: true });
}
