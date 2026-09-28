import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_SECTION_CONTENT,
  anchorFor,
  normalizeSectionPermissions,
} from "@/lib/site-sections";
import { deepMerge, legacyContentFor } from "@/lib/home";
import type { ResolvedHomeSection, SectionPermissions, SectionType } from "@/types";

/**
 * PORTFÓLIO DE MODELOS DE SITE.
 *
 * Cada modelo é um TEMPLATE INDEPENDENTE usado como ponto de partida na
 * ativação de um site novo:
 *
 *   MODELO (portfolio_models.sections — jsonb cópia)
 *      └─ na ativação: COPIA para tenant_sections + site_settings do usuário
 *           └─ site do usuário (totalmente independente do modelo)
 *
 * Depois da cópia o modelo e o site nunca mais se relacionam:
 *   - editar o modelo NÃO altera sites já criados;
 *   - editar o site NÃO altera o modelo;
 *   - duplicar um modelo cria um json novo (sem IDs/referências compartilhados).
 *
 * Nunca importa `lib/home` estaticamente a partir de fora: `lib/home`
 * importa este módulo por dynamic import para evitar ciclo.
 */

export interface PortfolioModelSection {
  key: string;
  type: SectionType;
  label: string;
  title?: string | null;
  subtitle?: string | null;
  enabled: boolean;
  is_required?: boolean;
  sort_order: number;
  settings: Record<string, unknown>;
  content: Record<string, unknown>;
  permissions: SectionPermissions;
}

export interface PortfolioModel {
  id: string;
  key: string;
  name: string;
  company: string | null;
  category: string | null;
  description: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  demo_url: string | null;
  status: string;
  is_default: boolean;
  is_selectable: boolean;
  sort_order: number;
  sections: PortfolioModelSection[];
  site_data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

/** Versão "leve" usada em cards da Home / /portfolio (sem seções). */
export interface PortfolioModelCard {
  key: string;
  name: string;
  company: string | null;
  category: string | null;
  description: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  demo_url: string | null;
  is_default: boolean;
}

const SELECT_COLUMNS =
  "id, key, name, company, category, description, thumbnail_url, cover_url, demo_url, status, is_default, is_selectable, sort_order, sections, site_data, created_at, updated_at";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toSection(raw: unknown, index: number): PortfolioModelSection | null {
  if (!isPlainObject(raw)) return null;
  const key = typeof raw.key === "string" && raw.key ? raw.key : null;
  if (!key) return null;
  return {
    key,
    type: (typeof raw.type === "string" && raw.type ? raw.type : key) as SectionType,
    label: typeof raw.label === "string" && raw.label ? raw.label : key,
    title: typeof raw.title === "string" ? raw.title : null,
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : null,
    enabled: raw.enabled !== false,
    is_required: raw.is_required === true,
    sort_order: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : (index + 1) * 10,
    settings: isPlainObject(raw.settings) ? raw.settings : {},
    content: isPlainObject(raw.content) ? raw.content : {},
    permissions: normalizeSectionPermissions(raw.permissions as SectionPermissions | undefined),
  };
}

export function normalizePortfolioModel(raw: unknown): PortfolioModel | null {
  if (!isPlainObject(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  const key = typeof raw.key === "string" ? raw.key : "";
  if (!id || !key) return null;
  const sectionsRaw = Array.isArray(raw.sections) ? raw.sections : [];
  const sections = sectionsRaw
    .map((s, i) => toSection(s, i))
    .filter((s): s is PortfolioModelSection => s !== null)
    .sort((a, b) => a.sort_order - b.sort_order);
  return {
    id,
    key,
    name: typeof raw.name === "string" && raw.name ? raw.name : key,
    company: typeof raw.company === "string" && raw.company ? raw.company : null,
    category: typeof raw.category === "string" && raw.category ? raw.category : null,
    description: typeof raw.description === "string" && raw.description ? raw.description : null,
    thumbnail_url: typeof raw.thumbnail_url === "string" && raw.thumbnail_url ? raw.thumbnail_url : null,
    cover_url: typeof raw.cover_url === "string" && raw.cover_url ? raw.cover_url : null,
    demo_url: typeof raw.demo_url === "string" && raw.demo_url ? raw.demo_url : null,
    status: typeof raw.status === "string" && raw.status ? raw.status : "active",
    is_default: raw.is_default === true,
    is_selectable: raw.is_selectable !== false,
    sort_order: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : 0,
    sections,
    site_data: isPlainObject(raw.site_data) ? raw.site_data : {},
    created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  };
}

export function toModelCard(model: PortfolioModel): PortfolioModelCard {
  return {
    key: model.key,
    name: model.name,
    company: model.company,
    category: model.category,
    description: model.description,
    thumbnail_url: model.thumbnail_url,
    cover_url: model.cover_url,
    demo_url: model.demo_url,
    is_default: model.is_default,
  };
}

function hasModelsTable(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Cache 60s — a Home usa ISR 60s e /portfolio é público.
let cache: { data: PortfolioModel[]; ts: number } | null = null;

export function invalidatePortfolioModelsCache(): void {
  cache = null;
}

/**
 * Lista os modelos. Por padrão: apenas ATIVOS.
 * Nunca lança: se a tabela ainda não existir (migração não aplicada),
 * devolve [] e o resto do sistema segue funcionando sem o Portfolio.
 */
export async function listPortfolioModels(
  opts: { activeOnly?: boolean; selectableOnly?: boolean } = {}
): Promise<PortfolioModel[]> {
  const activeOnly = opts.activeOnly !== false;
  const selectableOnly = opts.selectableOnly === true;
  if (!hasModelsTable()) return [];
  const useCache = activeOnly && !selectableOnly && cache && Date.now() - cache.ts < 60_000;
  if (useCache && cache) return cache.data;
  try {
    const admin = createAdminClient();
    let query = admin
      .from("portfolio_models")
      .select(SELECT_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (activeOnly) query = query.eq("status", "active");
    if (selectableOnly) query = query.eq("is_selectable", true);
    const { data, error } = await query;
    if (error) return [];
    const models = ((data as unknown[]) || [])
      .map(normalizePortfolioModel)
      .filter((m): m is PortfolioModel => m !== null);
    if (activeOnly && !selectableOnly) cache = { data: models, ts: Date.now() };
    return models;
  } catch {
    return [];
  }
}

export async function getPortfolioModelByKey(key: string): Promise<PortfolioModel | null> {
  if (!key || !hasModelsTable()) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("portfolio_models")
      .select(SELECT_COLUMNS)
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    return normalizePortfolioModel(data);
  } catch {
    return null;
  }
}

export async function getPortfolioModelById(id: string): Promise<PortfolioModel | null> {
  if (!id || !hasModelsTable()) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("portfolio_models")
      .select(SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return normalizePortfolioModel(data);
  } catch {
    return null;
  }
}

/**
 * Modelo usado quando o usuário NÃO escolheu nenhum (fallback obrigatório):
 * o Modelo Padrão — Óleos. Se não houver default, o primeiro ativo.
 */
export async function getDefaultPortfolioModel(): Promise<PortfolioModel | null> {
  const models = await listPortfolioModels();
  if (models.length === 0) return null;
  return models.find((m) => m.is_default) || models[0] || null;
}

/**
 * Modelo de ORIGEM do site de um tenant.
 * Prioridade: escolha do usuário → Modelo Padrão → nenhum.
 */
export async function resolveTenantPortfolioModel(
  tenantId: string,
  portfolioModelId?: string | null
): Promise<PortfolioModel | null> {
  if (portfolioModelId) {
    const chosen = await getPortfolioModelById(portfolioModelId);
    if (chosen) return chosen;
  }
  return getDefaultPortfolioModel();
}

// ---------------------------------------------------------------------------
// COPIA MODELO → SITE (independente, sem vínculo dinâmico)
// ---------------------------------------------------------------------------

export interface GlobalSectionRow {
  id: string;
  key?: string;
  type?: string;
  enabled?: boolean;
  content?: unknown;
  settings?: unknown;
  sort_order?: number;
}

export interface TenantSectionInsert {
  tenant_id: string;
  section_id: string;
  enabled: boolean;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  sort_order: number | null;
}

/**
 * Monta as linhas de `tenant_sections` a partir do modelo (ou do template
 * global quando não há modelo). Chaves do modelo são casadas com as seções
 * globais existentes via `key`/`type` (a FK exige o id global).
 *
 * A cópia é superficial e independente: conteúdo, settings, ativação e ordem
 * são gravados LINHA A LINHA do tenant — nenhuma referência ao modelo fica
 * guardada no site.
 */
export function buildTenantSectionRows(
  tenantId: string,
  globals: GlobalSectionRow[],
  model: PortfolioModel | null,
  alreadyHave: Set<string>
): TenantSectionInsert[] {
  const byKey = new Map<string, PortfolioModelSection>();
  if (model) {
    for (const s of model.sections) {
      if (s.key) byKey.set(s.key, s);
      if (s.type && !byKey.has(s.type)) byKey.set(s.type, s);
    }
  }
  const rows: TenantSectionInsert[] = [];
  for (const g of globals) {
    const gid = g.id;
    if (!gid || alreadyHave.has(gid)) continue;
    const match = model ? byKey.get(g.key || "") || byKey.get(g.type || "") : null;
    rows.push({
      tenant_id: tenantId,
      section_id: gid,
      enabled: match ? match.enabled !== false : g.enabled !== false,
      content: (match?.content as Record<string, unknown>) ||
        ((g.content as Record<string, unknown>) || {}),
      settings: (match?.settings as Record<string, unknown>) ||
        ((g.settings as Record<string, unknown>) || {}),
      sort_order: match ? match.sort_order : null,
    });
  }
  return rows;
}

/**
 * Merge dos dados do modelo sobre os dados do site.
 *
 * NUNCA sobrescreve personalização do usuário: só preenche o que está vazio
 * ou o que ainda é idêntico ao conteúdo oficial copiado no cadastro
 * (garante que um modelo de outra empresa substitua o texto-base do
 * doTERRA sem apagar o que o consultor já editou).
 */
export function applyModelSiteData(
  current: Record<string, unknown>,
  modelData: Record<string, unknown> | null | undefined,
  officialData: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!modelData || Object.keys(modelData).length === 0) return current;
  const out: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(modelData)) {
    if (value === undefined || value === null) continue;
    const now = out[key];
    if (now === undefined || now === null || now === "") {
      out[key] = value;
      continue;
    }
    const official = officialData ? officialData[key] : undefined;
    if (official !== undefined && JSON.stringify(now) === JSON.stringify(official)) {
      out[key] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// RENDERIZAÇÃO DO MODELO (demonstração /portfolio/[key])
// ---------------------------------------------------------------------------

/**
 * Converte a estrutura do modelo em seções renderizáveis — mesmo formato
 * produzido por `resolveHomeSections`, para reaproveitar o SiteHome inteiro.
 *
 * `siteData` (informações do site do modelo) entra como conteúdo legado;
 * `pricingContent` sobrepõe a oferta viva + condições de pagamento — igual ao
 * que a HOME real faz com a tabela `plans`.
 */
export function buildResolvedSectionsFromModel(
  model: PortfolioModel,
  extra?: { pricingContent?: Record<string, unknown>; siteData?: Record<string, unknown> | null }
): ResolvedHomeSection[] {
  const sections: ResolvedHomeSection[] = [];
  model.sections.forEach((s, index) => {
    if (!s.type) return;
    const base = DEFAULT_SECTION_CONTENT[s.type] || {};
    const content = deepMerge(
      base as Record<string, unknown>,
      extra?.siteData ? legacyContentFor(s.type, extra.siteData) : {},
      (s.content || {}) as Record<string, unknown>,
      s.type === "pricing" && extra?.pricingContent ? extra.pricingContent : {}
    );
    const perms = normalizeSectionPermissions(s.permissions);
    sections.push({
      id: `${model.id}-${s.key || s.type}`,
      type: s.type,
      key: s.key || s.type,
      label: s.label || s.type,
      title: s.title ?? null,
      subtitle: s.subtitle ?? null,
      enabled: s.enabled !== false,
      is_required: !!s.is_required,
      sort_order: s.sort_order ?? (index + 1) * 10,
      settings: (s.settings || {}) as Record<string, unknown>,
      content,
      permissions: perms,
      anchor: anchorFor(s.type),
      navLabel: ((s.settings?.navLabel as string) || s.label || s.type) as string,
      tenant_enabled: s.enabled !== false,
    });
  });
  return sections.sort((a, b) => a.sort_order - b.sort_order);
}

// ---------------------------------------------------------------------------
// ESCOLHA DO MODELO PELO USUÁRIO (durante a ativação)
// ---------------------------------------------------------------------------

export type SelectModelResult =
  | { ok: true; model: PortfolioModel }
  | { ok: false; error: string; status: number };

/**
 * Registra a escolha do modelo no tenant. Só é permitido ENQUANTO o site
 * ainda não existe (nunca ativo): depois que o site nasceu, o modelo é
 * história — trocar não poderia (e não deve) recriar o site.
 */
export async function selectPortfolioModelForTenant(
  tenantId: string,
  modelKey: string
): Promise<SelectModelResult> {
  if (!hasModelsTable()) {
    return { ok: false, error: "Portfolio indisponível no momento.", status: 503 };
  }
  const model = await getPortfolioModelByKey(modelKey);
  if (!model) return { ok: false, error: "Modelo não encontrado.", status: 404 };
  if (model.status !== "active" || !model.is_selectable) {
    return { ok: false, error: "Este modelo não está disponível para novos sites.", status: 400 };
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, site_status")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Site não encontrado.", status: 404 };
  if ((tenant as { site_status?: string }).site_status !== "pending") {
    return {
      ok: false,
      error:
        "Seu site já foi criado e não pode mudar de modelo. Você continua podendo personalizar tudo em Meu Site.",
      status: 409,
    };
  }

  const { error } = await admin
    .from("tenants")
    .update({ portfolio_model_id: model.id })
    .eq("id", tenantId);
  if (error) return { ok: false, error: "Não foi possível salvar o modelo escolhido.", status: 500 };

  return { ok: true, model };
}
