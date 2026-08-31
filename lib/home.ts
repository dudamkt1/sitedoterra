import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SECTIONS, DEFAULT_SECTION_CONTENT, anchorFor, normalizeSectionPermissions } from "@/lib/site-sections";
import { getActiveOffer, buildPricingContent } from "@/lib/commercial";
import { resolveGateways } from "@/lib/gateway-config";
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

// Cache simples em memória (60s) para evitar 3 queries repetidas por request na HOME
let globalSectionsCache: { data: SiteSection[]; ts: number } | null = null;
let activeOfferCache: { data: unknown; ts: number } | null = null;

export async function getGlobalSections(): Promise<SiteSection[]> {
  if (!hasSupabaseEnv()) return DEFAULT_SECTIONS;
  if (globalSectionsCache && Date.now() - globalSectionsCache.ts < 60_000) return globalSectionsCache.data;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("site_sections")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data || data.length === 0) return DEFAULT_SECTIONS;
  const mapped = (data as unknown as SiteSection[]).map((s) => ({
    ...s,
    permissions: normalizeSectionPermissions(s.permissions),
  }));
  globalSectionsCache = { data: mapped, ts: Date.now() };
  return mapped;
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
    case "footer": {
      const rawSocial = (d.social as Record<string, unknown>) || {};
      const social: Record<string, unknown> = {};
      for (const key of ["instagram", "facebook", "youtube"] as const) {
        const v = rawSocial[key];
        if (v === false) {
          social[key] = { enabled: false, url: undefined };
        } else if (v === true) {
          social[key] = { enabled: true, url: undefined };
        } else if (isPlainObject(v)) {
          social[key] = {
            enabled: v.enabled !== false,
            url: typeof v.url === "string" && v.url.trim() ? v.url : undefined,
          };
        }
      }
      return {
        _contactWhatsapp: d.whatsapp,
        _contactEmail: d.email,
        _contactInstagram: d.instagram ? `https://instagram.com/${String(d.instagram).replace(/^@/, "")}` : undefined,
        _profileName: d.fullName || (d.name && d.surname ? `${d.name} ${d.surname}` : undefined),
        social,
      };
    }
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
  // Paraleliza global + tenant (economiza ~1 RTT Supabase)
  const [global, tenantMapRaw] = await Promise.all([
    opts.globalSections ? Promise.resolve(opts.globalSections) : getGlobalSections(),
    opts.tenantSectionMap
      ? Promise.resolve(opts.tenantSectionMap)
      : opts.tenant?.tenant_id && hasSupabaseEnv()
        ? getTenantSections(opts.tenant.tenant_id)
        : Promise.resolve(new Map<string, TenantSection>()),
  ]);
  const globalSections = global as SiteSection[];
  const siteData = (opts.tenant?.site_data || {}) as Record<string, unknown>;
  const tenantMap: Map<string, TenantSection> = (tenantMapRaw as Map<string, TenantSection>) || new Map();

  // Fonte de verdade comercial: a seção "Planos / Oferta" exibe os dados
  // cadastrados pelo Super Admin (tabela plans), nunca valores em código.
  const hasPricing = globalSections.some((s) => s.type === "pricing");
  // usa cache de 60s para plans também
  let activeOffer: unknown = null;
  if (hasPricing) {
    if (activeOfferCache && Date.now() - activeOfferCache.ts < 60_000) {
      activeOffer = activeOfferCache.data;
    } else {
      activeOffer = await getActiveOffer();
      activeOfferCache = { data: activeOffer, ts: Date.now() };
    }
  }
  const pricingOverlay = activeOffer ? buildPricingContent(activeOffer as never) : {};

  // Condições de pagamento (PIX + parcelamento) resolvidas uma única vez por request.
  // São opcionais — se nada estiver configurado, a HOME segue exibindo apenas o preço.
  // A oferta comercial (plans) é a fonte de verdade do VALOR; o gateway (payment_config)
  // é a fonte de verdade das CONDIÇÕES. Mantemos a mesma aritmética usada pelo checkout.
  let paymentConditions: Record<string, unknown> | null = null;
  if (hasPricing) {
    try {
      const gateways = await resolveGateways();
      const pixDiscount = Math.min(50, Math.max(0, Number(gateways.mercadopago.pixDiscountPercent) || 0));
      const installments = Math.min(12, Math.max(0, Math.round(Number(gateways.mercadopago.installments) || 0)));
      const withoutInterest = gateways.mercadopago.installmentsWithoutInterest !== false;
      const activationCents = (activeOffer as { activation_price_cents?: number } | null)?.activation_price_cents || 0;
      const pixCents = pixDiscount > 0 ? Math.round((activationCents * (100 - pixDiscount)) / 100) : activationCents;
      paymentConditions = {
        gateway: gateways.gateway,
        pixDiscountPercent: pixDiscount,
        installments,
        installmentsWithoutInterest: withoutInterest,
        pixCents,
      };
    } catch {
      paymentConditions = null;
    }
  }

  const resolved: ResolvedHomeSection[] = [];

  for (const section of globalSections) {
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
    // Prioridade na HOME do tenant:
    //   OVERRIDE DO USUÁRIO vence tudo (o que ele salva no editor "Minha Home"
    //   aparece no site). O LEGADO ("Informações do site") preenche os campos
    //   de perfil que não fazem parte dos editores de seção; campos que o
    //   usuário personalizou ficam congelados nele mesmo — intenção dele.
    //   Na HOME global ("/"), o conteúdo global vence.
    const merged = opts.tenantDataOverridesGlobal
      ? deepMerge(
          DEFAULT_SECTION_CONTENT[section.type] || {},
          globalContent,
          legacy,
          override?.content || {},
          section.type === "pricing" ? pricingOverlay : {},
          section.type === "pricing" && paymentConditions ? { paymentConditions } : {}
        )
      : deepMerge(
          DEFAULT_SECTION_CONTENT[section.type] || {},
          legacy,
          globalContent,
          override?.content || {},
          section.type === "pricing" ? pricingOverlay : {},
          section.type === "pricing" && paymentConditions ? { paymentConditions } : {}
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
