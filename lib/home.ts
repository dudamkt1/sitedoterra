import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SECTIONS, DEFAULT_SECTION_CONTENT, anchorFor, normalizeSectionPermissions } from "@/lib/site-sections";
import { normalizeParagraphs } from "@/lib/section-fields";
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
 * REGRA DE ISOLAMENTO (sites de tenants ativos):
 * o site é FOTOGRAFADO na ativação (cópia integral do template global em
 * `tenant_sections` + carimbo `_sections_snapshot_at` em site_settings) e,
 * a partir daí, NUNCA mais segue edições do /admin/editor-home — só o
 * painel individual do dono (`tenant_sections` + `site_settings`) altera o
 * site. Somente os FUTUROS tenants recebem o template vigente ao ativar.
 * A HOME oficial `/` (domínio principal) continua sempre viva no global.
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

/**
 * Invalida o cache de seções globais (chamar após salvar site_settings,
 * tenant_sections ou site_sections — senão o site público serve conteúdo
 * velho por até 60s).
 */
export function invalidateGlobalSectionsCache(): void {
  globalSectionsCache = null;
}

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

/**
 * Carimbo em `site_settings.data` que marca o congelamento do site: a partir
 * deste momento o template global vigente foi fotografado em
 * `tenant_sections` e edições do admin NÃO propagam mais para este tenant.
 */
export const SECTIONS_SNAPSHOT_MARKER = "_sections_snapshot_at";

/**
 * FOTOGRAFIA NA ATIVAÇÃO: copia o template global vigente (`site_sections`)
 * para `tenant_sections` do tenant — SOMENTE as seções que ele ainda não tem
 * (nunca sobrescreve personalização existente; idempotente e seguro para
 * repetir). Ao final, carimba `site_settings.data._sections_snapshot_at`.
 *
 * REGRA DE REATIVAÇÃO EXATA: se o carimbo já existe (site já foi ativado
 * antes, mesmo que desativado no momento), NADA é copiado — a HOME própria
 * armazenada é restaurada exatamente como estava, sem puxar o modelo atual.
 *
 * Usado em:
 *  - ativação do tenant (`activateTenant` — futuros usuários recebem a HOME
 *    definida pelo admin como padrão; reativações não tocam em nada);
 *  - primeira resolução pós-deploy (tenants antigos já ativos: congela o
 *    estado atual uma única vez; daí em diante o admin não os altera mais).
 *
 * Retorna quantas linhas foram criadas. Nunca lança (best-effort).
 */
export async function snapshotTenantSections(tenantId: string): Promise<number> {
  if (!hasSupabaseEnv() || !tenantId) return 0;
  try {
    const admin = createAdminClient();
    const [{ data: settingsRow }, { data: globals }, { data: existing }] = await Promise.all([
      admin.from("site_settings").select("data").eq("tenant_id", tenantId).maybeSingle(),
      admin.from("site_sections").select("id, enabled, content, settings"),
      admin.from("tenant_sections").select("section_id").eq("tenant_id", tenantId),
    ]);
    // Reativação (ou snapshot já feito): carimbo presente = configuração
    // própria existente — restaura exatamente como estava, sem copiar nada.
    const currentData = ((settingsRow?.data as Record<string, unknown>) || {}) as Record<string, unknown>;
    if (typeof currentData[SECTIONS_SNAPSHOT_MARKER] === "string") return 0;
    const globalRows = (globals as { id: string; enabled: boolean; content: unknown; settings: unknown }[] | null) || [];
    // Sem template global no banco não há o que fotografar (a renderização
    // usa os padrões estáticos em memória, igual a hoje).
    if (globalRows.length === 0) return 0;
    const have = new Set(((existing as { section_id: string }[] | null) || []).map((r) => r.section_id));
    const missing = globalRows.filter((s) => !have.has(s.id));
    if (missing.length > 0) {
      const rows = missing.map((s) => ({
        tenant_id: tenantId,
        section_id: s.id,
        enabled: s.enabled !== false,
        content: (s.content as Record<string, unknown>) || {},
        settings: (s.settings as Record<string, unknown>) || {},
      }));
      const { error } = await admin
        .from("tenant_sections")
        .upsert(rows, { onConflict: "tenant_id,section_id", ignoreDuplicates: true });
      if (error) {
        console.warn("[home] snapshot de seções falhou", error.message);
        return 0;
      }
    }
    // Carimba o congelamento (cria site_settings se ainda não existir).
    try {
      const data = { ...currentData, [SECTIONS_SNAPSHOT_MARKER]: new Date().toISOString() };
      await admin.from("site_settings").upsert({ tenant_id: tenantId, data }, { onConflict: "tenant_id" });
    } catch (e) {
      console.warn("[home] carimbo de snapshot falhou", (e as Error)?.message);
    }
    return missing.length;
  } catch (e) {
    console.warn("[home] snapshotTenantSections falhou", (e as Error)?.message);
    return 0;
  }
}

/** Mapeia os campos legados de site_settings.data para o conteúdo da seção. */
function legacyContentFor(type: string, siteData: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const d = siteData || {};
  // String vazia = campo não preenchido → undefined para NÃO apagar o
  // conteúdo global do template no deepMerge (só undefined/null são pulados).
  // Mesmo critério da demonstração (DemoPublicSite usa `||` como fallback).
  const str = (v: unknown): string | undefined => {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? (v as string) : undefined;
  };
  const stats = (d.stats as Record<string, unknown>) || {};
  switch (type) {
    case "hero": {
      const statEntries = [
        { value: str(stats.years), label: (str(stats.labelYears) as string) || "Anos de experiência" },
        { value: str(stats.clients), label: (str(stats.labelClients) as string) || "Clientes atendidas" },
        { value: str(stats.satisfaction), label: (str(stats.labelSatisfaction) as string) || "Satisfação" },
      ].filter((s) => Boolean(s.value));
      return {
        eyebrow: str(d.eyebrow),
        firstName: str(d.name),
        lastName: str(d.surname),
        role: str(d.role),
        description: str(d.description),
        badgeTitle: str(d.badgeTitle),
        badgeSubtitle: str(d.badgeSubtitle),
        stats: statEntries.length > 0 ? statEntries : undefined,
      };
    }
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
   * Quando true (sites de tenants em /[slug] E a HOME oficial `/`, que é o
   * site do tenant oficial), os dados PRÓPRIOS do tenant (site_settings.data
   * — editados em /painel/meu-site ou /admin/editor-home) têm precedência
   * sobre o conteúdo GLOBAL (site_sections, o template padrão da plataforma).
   * Campos vazios/ausentes caem para o global (nunca apagam o template).
   * Quando false, o conteúdo global vence.
   */
  tenantDataOverridesGlobal?: boolean;
  /**
   * Quando true, ignora os overrides do tenant (tenant_sections) — a página
   * renderiza o conteúdo GLOBAL + site_settings. Usado pela HOME oficial
   * (`/`), que é controlada pelo /admin/editor-home: assim, tudo o que o
   * super admin edita nas seções reflete no domínio principal, mesmo que o
   * tenant oficial tenha personalizações antigas salvas (elas continuam no
   * banco, só não são aplicadas aqui).
   */
  ignoreTenantOverrides?: boolean;
  /**
   * CONGELAMENTO (sites de tenants em `/[slug]` e no painel do dono):
   * o conteúdo editorial é lido da FOTOGRAFIA do tenant (`tenant_sections`,
   * feita na ativação) e o template global vigente é IGNORADO — edições do
   * /admin/editor-home (logo, textos, imagens) NÃO propagam para sites já
   * ativados. Seções criadas pelo admin DEPOIS do congelamento nem aparecem
   * nesses sites (só futuros tenants as recebem ao ativar).
   *
   * O congelamento efetivo exige site JÁ ATIVADO alguma vez (site_status
   * diferente de "pending" ou carimbo de snapshot presente — desativados
   * continuam congelados). Sites NUNCA ativados ignoram este modo e seguem a
   * HOME modelo ao vivo, mesmo com a flag ligada.
   *
   * Continuam vivos (não congelam): dados do próprio tenant
   * (`site_settings` — o painel individual segue alterando o site) e dados
   * comerciais vigentes (preços/condições da oferta — `pricingOverlay`).
   * Nunca usar junto com `ignoreTenantOverrides` nem para o tenant oficial.
   */
  frozenTenantContent?: boolean;
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
    opts.ignoreTenantOverrides
      ? Promise.resolve(new Map<string, TenantSection>())
      : opts.tenantSectionMap
        ? Promise.resolve(opts.tenantSectionMap)
        : opts.tenant?.tenant_id && hasSupabaseEnv()
          ? getTenantSections(opts.tenant.tenant_id)
          : Promise.resolve(new Map<string, TenantSection>()),
  ]);
  const globalSections = global as SiteSection[];
  const siteData = (opts.tenant?.site_data || {}) as Record<string, unknown>;
  let tenantMap: Map<string, TenantSection> = (tenantMapRaw as Map<string, TenantSection>) || new Map();

  // Congelamento: vale SOMENTE para sites que já foram ativados alguma vez
  // (site_status diferente de "pending" ou carimbo presente — desativados
  // continuam congelados). Sites NUNCA ativados seguem a HOME modelo ao vivo:
  // edições do admin refletem neles até a ativação. Se o tenant ainda não foi
  // fotografado, fotografa AGORA o template vigente — uma única vez — e usa a
  // fotografia nesta renderização.
  const tenantId = opts.tenant?.tenant_id;
  const tenantStatus = (opts.tenant as { site_status?: unknown } | null)?.site_status;
  const marked = typeof siteData[SECTIONS_SNAPSHOT_MARKER] === "string";
  const everActivated =
    marked || (typeof tenantStatus === "string" ? tenantStatus !== "pending" : tenantMap.size > 0);
  const frozenCandidate = opts.frozenTenantContent === true && !!tenantId && hasSupabaseEnv();
  if (frozenCandidate && tenantId && everActivated && (!marked || tenantMap.size === 0)) {
    const created = await snapshotTenantSections(tenantId);
    if (created > 0) tenantMap = await getTenantSections(tenantId);
  }
  const frozenTenant = frozenCandidate && everActivated && tenantMap.size > 0;

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

    // Congelado e sem fotografia desta seção = seção criada pelo admin DEPOIS
    // da ativação: não entra em sites já ativos (só futuros tenants a terão).
    if (frozenTenant && !override) continue;

    // Visibilidade: global ativo E (se o usuário pode desativar) usuário ativo.
    // No modo congelado, quem manda é a fotografia do tenant — o admin não
    // liga/desliga seções de sites ativos pelo editor global.
    let enabled = section.enabled !== false;
    if (frozenTenant) {
      enabled = override ? override.enabled !== false : false;
    } else if (enabled && canToggle && override) {
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
    //   No MODO CONGELADO, o conteúdo global vigente é excluído da mescla: a
    //   base é a fotografia da ativação + dados do próprio tenant. (Preços e
    //   condições da oferta vigente continuam vivos — são dados comerciais da
    //   plataforma, não conteúdo editorial.)
    const merged = frozenTenant
      ? deepMerge(
          DEFAULT_SECTION_CONTENT[section.type] || {},
          legacy,
          override?.content || {},
          section.type === "pricing" ? pricingOverlay : {},
          section.type === "pricing" && paymentConditions ? { paymentConditions } : {}
        )
      : opts.tenantDataOverridesGlobal
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
    // Blindagem: a seção "História / Sobre" já foi corrompida uma vez para
    // paragraphs=[{ p: "..." }] pelo editor antigo. Normaliza aqui para que
    // nenhum dado legado no banco quebre a HOME pública (tela branca).
    if (section.type === "story" && content && typeof content === "object" && "paragraphs" in (content as Record<string, unknown>)) {
      (content as Record<string, unknown>).paragraphs = normalizeParagraphs(
        (content as Record<string, unknown>).paragraphs
      );
    }

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
