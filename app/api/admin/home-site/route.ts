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
 * SINCRONIA TOTAL com o domínio principal: a HOME monta cada seção como
 * global → site_settings → tenant_sections (override vence). Como o tenant
 * oficial possui overrides (hero/story com imagens e textos próprios), este
 * endpoint também propaga os campos de perfil para dentro desses overrides —
 * preservando as demais chaves (imagens, botões, layout). Assim, tudo o que
 * for modificado na seção reflete na home principal.
 *
 * GET  → { tenant, siteData } (site_settings + overlay dos overrides p/ exibição)
 * POST → salva site_settings, propaga perfil p/ overrides e invalida caches.
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

/** Mapa section_id → type das seções globais (para achar hero/story do oficial). */
async function getSectionTypeMap(
  admin: ReturnType<typeof createAdminClient>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data } = await admin.from("site_sections").select("id, type");
    for (const s of (data as { id: string; type: string }[]) || []) {
      map.set(s.id, s.type);
    }
  } catch {
    // sem mapa, sem propagação
  }
  return map;
}

function nonEmpty(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s || undefined;
}

/**
 * Chaves de perfil do hero derivadas do site_data (mesma correspondência do
 * `legacyContentFor` em lib/home.ts). Valores vazios viram `undefined` para
 * NÃO apagar o template — só valores reais sobrescrevem.
 */
function heroProfileKeys(siteData: Record<string, unknown>): Record<string, unknown> {
  const stats = (siteData.stats as Record<string, unknown>) || {};
  const entries = [
    { value: nonEmpty(stats.years), label: (nonEmpty(stats.labelYears) as string) || "Anos de experiência" },
    { value: nonEmpty(stats.clients), label: (nonEmpty(stats.labelClients) as string) || "Clientes atendidas" },
    { value: nonEmpty(stats.satisfaction), label: (nonEmpty(stats.labelSatisfaction) as string) || "Satisfação" },
  ].filter((s) => Boolean(s.value));
  return {
    firstName: nonEmpty(siteData.name),
    lastName: nonEmpty(siteData.surname),
    role: nonEmpty(siteData.role),
    eyebrow: nonEmpty(siteData.eyebrow),
    description: nonEmpty(siteData.description),
    badgeTitle: nonEmpty(siteData.badgeTitle),
    badgeSubtitle: nonEmpty(siteData.badgeSubtitle),
    stats: entries.length > 0 ? entries : undefined,
  };
}

/** Aplica chaves de perfil num override preservando as demais (imagens, botões...). */
function applyProfileKeys(
  current: Record<string, unknown>,
  keys: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...(current || {}) };
  for (const [k, v] of Object.entries(keys)) {
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  return next;
}

/**
 * Propaga os campos de perfil do site_data para os overrides
 * (tenant_sections) do tenant oficial — hero e selo da story. As demais
 * chaves dos overrides (imagens, botões, parágrafos, layout) são preservadas.
 */
async function syncTenantOverrides(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  siteData: Record<string, unknown>
) {
  const typeMap = await getSectionTypeMap(admin);
  if (typeMap.size === 0) return;
  const { data: overrides } = await admin
    .from("tenant_sections")
    .select("section_id, content")
    .eq("tenant_id", tenantId);
  if (!overrides) return;

  const profile = heroProfileKeys(siteData);
  const years = nonEmpty((siteData.stats as Record<string, unknown> | undefined)?.years);

  for (const ov of overrides as { section_id: string; content: unknown }[]) {
    const type = typeMap.get(ov.section_id);
    const content = (ov.content as Record<string, unknown>) || {};
    if (type === "hero") {
      const next = applyProfileKeys(content, profile);
      if (JSON.stringify(next) !== JSON.stringify(content)) {
        await admin
          .from("tenant_sections")
          .update({ content: next })
          .eq("tenant_id", tenantId)
          .eq("section_id", ov.section_id);
      }
    } else if (type === "story") {
      const next = { ...content };
      if (years) next.badgeValue = years;
      else delete next.badgeValue;
      if (JSON.stringify(next) !== JSON.stringify(content)) {
        await admin
          .from("tenant_sections")
          .update({ content: next })
          .eq("tenant_id", tenantId)
          .eq("section_id", ov.section_id);
      }
    }
  }
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

  const stored = (settings?.data as Record<string, unknown>) || {};

  // Retorna o site_settings PURO: é exatamente a fonte que o domínio
  // principal renderiza (a HOME oficial mescla global + site_settings,
  // ignorando tenant_sections). Sem overlay — o formulário mostra o mesmo
  // conteúdo do ar; campos vazios caem para o template na home.
  return NextResponse.json({
    tenant: { id: tenant.id, slug: tenant.slug, domain: tenant.domain || null, source: tenant.source },
    siteData: stored,
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

  // Propaga o perfil para os overrides (hero/story) — sem isso a home
  // continuaria exibindo os valores antigos dos overrides.
  try {
    await syncTenantOverrides(admin, tenant.id, merged);
  } catch (e) {
    console.error("[admin/home-site] falha ao sincronizar overrides", e);
  }

  invalidateOfficialHomeCache();
  try {
    revalidatePath("/");
  } catch {
    // best-effort
  }

  return NextResponse.json({ success: true });
}
