import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SECTIONS, DEFAULT_SECTION_CONTENT, anchorFor, normalizeSectionPermissions } from "@/lib/site-sections";
import { getActiveOffer, buildPricingContent } from "@/lib/commercial";
import type { PublicTenant, ResolvedHomeSection, SiteSection, TenantSection } from "@/types";

/**
 * Resolve a HOME de um site com a cadeia:
 *
 *   CONFIGURAÇÃO GLOBAL (site_sections)
 *        ↓
 *   LEGADO DO TENANT (site_settings.data — campos antigos)
 *        ↓
 *   CONFIGURAÇÃO DO USUÁRIO (tenant_sections)
 *        ↓
 *   HOME PÚBLICA
 *
 * A sobreposição do usuário vence; se não houver, usa o global.
 */

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepMerge<T extends Record<string, unknown>>(base: T, ...overrides: (Record<string, unknown> | undefined)[]): T {
  let out: Record<string, unknown> = { ...base };
  for (const override of overrides) {
    if (!override) continue;
    for (const [key, value] of Object.entries(override)) {
      if (value === undefined || value === null) continue;
      const existing = out[key];
      if (isPlainObject(existing) && isPlainObject(value)) {
        out[key] = deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        out[key] = value;
      }
    }
  }
  return out as T;
}

export async function getGlobalSections(): Promise<SiteSection[]> {
  if (!hasSupabaseEnv()) return DEFAULT_SECTIONS;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("site_sections")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data || data.length === 0) return DEFAULT_SECTIONS;
  return (data as unknown as SiteSection[]).map((s) => ({
    ...s,
    permissions: normalizeSectionPermissions(s.permissions),
  }));
}

export async function getTenantSections(tenantId: string): Promise<Map<string, TenantSection>> {
  const map = new Map<string, TenantSection>();
  if (!hasSupabaseEnv()) return map;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenant_sections")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error || !data) return map;
  for (const row of data as unknown as TenantSection[]) {
    map.set(row.section_id, row);
  }
  return map;
}

/** Mapeia os campos legados de site_settings.data para o conteúdo da seção. */
function legacyContentFor(type: string, siteData: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const d = siteData || {};
  const stats = (d.stats as Record<string, unknown>) || {};
  switch (type) {
    case "hero":
      return {
        eyebrow: d.eyebrow,
        firstName: d.name,
        lastName: d.surname,
        role: d.role,
        description: d.description,
        badgeTitle: d.badgeTitle,
        badgeSubtitle: d.badgeSubtitle,
        stats: stats.years || stats.clients || stats.satisfaction
          ? [
              { value: stats.years, label: stats.labelYears || "Anos de experiência" },
              { value: stats.clients, label: stats.labelClients || "Clientes atendidas" },
              { value: stats.satisfaction, label: stats.labelSatisfaction || "Satisfação" },
            ]
          : undefined,
      };
    case "testimonials":
      return d.testimonials && Array.isArray(d.testimonials) && (d.testimonials as unknown[]).length > 0
        ? { items: d.testimonials }
        : {};
    case "story":
      return {
        paragraphs: (d.history as { paragraphs?: unknown } | undefined)?.paragraphs,
        signature: (d.history as { signature?: unknown } | undefined)?.signature,
        badgeValue: stats.years,
        badgeLabel: "transformando vidas",
      };
    case "video":
      return { thumbLabel: (d.video as { label?: unknown } | undefined)?.label };
    case "booking":
      return d.schedule ? { schedule: d.schedule } : {};
    case "tips":
      return {
        instagramHandle: d.instagramHandle,
        instagramUrl: d.instagram ? `https://instagram.com/${String(d.instagram).replace(/^@/, "")}` : undefined,
      };
    case "products":
      return d.products && Array.isArray(d.products) && (d.products as unknown[]).length > 0
        ? { items: d.products, _contactWhatsapp: d.whatsapp }
        : { _contactWhatsapp: d.whatsapp };
    case "faq":
      return d.faq && Array.isArray(d.faq) && (d.faq as unknown[]).length > 0 ? { items: d.faq } : {};
    case "footer":
      return {
        _contactWhatsapp: d.whatsapp,
        _contactEmail: d.email,
        _contactInstagram: d.instagram ? `https://instagram.com/${String(d.instagram).replace(/^@/, "")}` : undefined,
        _profileName: d.fullName || (d.name && d.surname ? `${d.name} ${d.surname}` : undefined),
      };
    case "hero2contact":
      return { _contactWhatsapp: d.whatsapp, _contactEmail: d.email };
    default:
      return {};
  }
}

export interface ResolveOptions {
  tenant: PublicTenant | null;
  globalSections?: SiteSection[];
  tenantSectionMap?: Map<string, TenantSection>;
  /**
   * Quando true (sites de tenants em /slug), os dados PRÓPRIOS do tenant
   * (site_settings.data — editados em /painel/meu-site) têm precedência sobre
   * o conteúdo GLOBAL (site_sections, o template padrão da plataforma).
   * Quando false (HOME "/", que é o template global), o conteúdo global vence.
   */
  tenantDataOverridesGlobal?: boolean;
}

/**
 * Monta a lista final de seções exibíveis na HOME.
 * - Filtra seções desativadas globalmente ou (quando permitido) pelo usuário.
 * - Ordena por sort_order.
 * - Mescla conteúdo global + legado + override do usuário.
 */
export async function resolveHomeSections(opts: ResolveOptions): Promise<ResolvedHomeSection[]> {
  const global = opts.globalSections || (await getGlobalSections());
  const siteData = (opts.tenant?.site_data || {}) as Record<string, unknown>;
  let tenantMap = opts.tenantSectionMap;
  if (!tenantMap && opts.tenant?.tenant_id && hasSupabaseEnv()) {
    tenantMap = await getTenantSections(opts.tenant.tenant_id);
  }
  tenantMap = tenantMap || new Map<string, TenantSection>();

  // Fonte de verdade comercial: a seção "Planos / Oferta" exibe os dados
  // cadastrados pelo Super Admin (tabela plans), nunca valores em código.
  const hasPricing = global.some((s) => s.type === "pricing");
  const activeOffer = hasPricing ? await getActiveOffer() : null;
  const pricingOverlay = activeOffer ? buildPricingContent(activeOffer) : {};

  const resolved: ResolvedHomeSection[] = [];

  for (const section of global) {
    const perms = normalizeSectionPermissions(section.permissions);
    const override = tenantMap.get(section.id);
    const canToggle = perms.can_toggle !== false && !section.is_required;

    // Visibilidade: global ativo E (se o usuário pode desativar) usuário ativo
    let enabled = section.enabled !== false;
    if (enabled && canToggle && override) {
      enabled = override.enabled !== false;
    }

    const legacy = legacyContentFor(section.type, siteData);
    const globalContent = section.content || {};
    // A fonte de verdade para os dados do perfil (site_settings.data, editados
    // em /painel/meu-site → "Informações do site") é o LEGADO. Ele deve vencer
    // qualquer conteúdo salvo em tenant_sections (editor "Minha Home"), senão
    // valores congelados de nome/cargo/descrição/estatísticas deixam de refletir
    // as alterações do usuário. Por isso, na HOME do tenant, o legado vem DEPOIS
    // do override. Os demais campos (imagem, botões, textos da seção) continuam
    // vindo do override quando o usuário personaliza a seção.
    const merged = opts.tenantDataOverridesGlobal
      ? deepMerge(
          DEFAULT_SECTION_CONTENT[section.type] || {},
          globalContent,
          override?.content || {},
          legacy,
          section.type === "pricing" ? pricingOverlay : {}
        )
      : deepMerge(
          DEFAULT_SECTION_CONTENT[section.type] || {},
          legacy,
          globalContent,
          override?.content || {},
          section.type === "pricing" ? pricingOverlay : {}
        );
    const content = merged;

    const navLabel = (override?.settings?.navLabel as string) || (section.settings?.navLabel as string) || section.label;

    resolved.push({
      ...section,
      enabled,
      permissions: perms,
      content,
      anchor: anchorFor(section.type),
      navLabel,
      tenant_override: !!override,
      tenant_enabled: override ? override.enabled !== false : true,
    });
  }

  return resolved.sort((a, b) => a.sort_order - b.sort_order);
}

/** Extrai os itens de navegação a partir das seções visíveis. */
export function navFromSections(sections: ResolvedHomeSection[]): { label: string; href: string }[] {
  return sections
    .filter((s) => s.enabled && s.settings?.showInNav !== false && s.type !== "header" && s.type !== "footer")
    .map((s) => ({ label: s.navLabel || s.label, href: `#${s.anchor}` }));
}
