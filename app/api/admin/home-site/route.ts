import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getOfficialHomeTenant, invalidateOfficialHomeCache } from "@/lib/site-official";
import { getPublicTenantByDomain } from "@/lib/tenant";
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

async function resolveOfficialTenantId(admin: ReturnType<typeof createAdminClient>) {
  // 1) Domínio principal — as informações do /admin/editor-home são SEMPRE
  //    as do domínio principal (ex.: oleos.topconsultores.com.br).
  const host = mainDomainHostname();
  if (host) {
    try {
      const byDomain = await getPublicTenantByDomain(host);
      const tid = byDomain?.tenant_id || null;
      if (tid && tid !== "index") {
        const { data: row } = await admin
          .from("tenants")
          .select("id, slug")
          .eq("id", tid)
          .maybeSingle();
        if (row) return { ...(row as { id: string; slug: string }), domain: host };
      }
    } catch {
      // cai para o fallback abaixo
    }
  }

  // 2) Fallback: resolução oficial anterior (RPC / platform_config / superadmin).
  const official = await getOfficialHomeTenant();
  const tenantId = official?.tenant_id || null;
  // "index"/demo = fallback estático (sem banco) — nada para editar.
  if (!tenantId || tenantId === "index") return null;
  const { data: row } = await admin
    .from("tenants")
    .select("id, slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (!row) return null;
  return { ...(row as { id: string; slug: string }), domain: host };
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
    tenant: { id: tenant.id, slug: tenant.slug, domain: tenant.domain || null },
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
