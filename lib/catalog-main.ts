/**
 * Catálogo do DOMÍNIO PRINCIPAL (https://oleos.topconsultores.com.br/catalogo).
 *
 * Guardado em `platform_config` (chave `main_catalog`, jsonb) — o mesmo
 * repositório de configurações globais usado por /admin/dominios. Assim o
 * catálogo da plataforma fica ISOLADO dos `crm_products` de cada tenant:
 * nada muda no catálogo público `/catalogo/[slug]` dos usuários.
 *
 * Módulo puro (sem server-only): usado pela página pública, pela API admin
 * e pelo formulário do /admin/catalogo.
 */

export const MAIN_CATALOG_KEY = "main_catalog";

export const MAIN_CATALOG_MAX_PRODUCTS = 300;

export type MainCatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string | null;
  image_url: string | null;
  unit: string;
  order: number;
  active: boolean;
};

export type MainCatalog = {
  enabled: boolean;
  title: string;
  subtitle: string;
  whatsapp: string;
  products: MainCatalogProduct[];
};

export const DEFAULT_MAIN_CATALOG: MainCatalog = {
  enabled: true,
  title: "Catálogo",
  subtitle: "Conheça os produtos e kits disponíveis.",
  whatsapp: "",
  products: [],
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown, max = 200): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return s.length > max ? s.slice(0, max) : s;
}

function int(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function bool(v: unknown, fallback = true): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1) return true;
  if (v === "false" || v === 0) return false;
  return fallback;
}

function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // cai no fallback
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** "1.234,50" | "12.50" | "R$ 39,90" → centavos (inteiro >= 0). */
export function parseBRLToCents(input: unknown): number {
  const raw = String(input ?? "")
    .replace(/[^\d.,-]/g, "")
    .trim();
  if (!raw) return 0;
  let normalized = raw;
  if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

export function centsToBRLInput(cents: number): string {
  return ((Number(cents) || 0) / 100).toFixed(2).replace(".", ",");
}

export function formatBRL(cents: number): string {
  return ((Number(cents) || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Aceita objeto jsonb OU string JSON (PostgREST às vezes devolve aspas). */
export function parseMaybeJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Normaliza/sanitiza qualquer payload salvo (ou vindo da API) em MainCatalog. */
export function normalizeMainCatalog(raw: unknown): MainCatalog {
  const source = asRecord(parseMaybeJson(raw));
  if (!source) return { ...DEFAULT_MAIN_CATALOG, products: [] };

  const rawProducts = Array.isArray(source.products) ? source.products : [];
  const products: MainCatalogProduct[] = [];

  for (const item of rawProducts) {
    if (products.length >= MAIN_CATALOG_MAX_PRODUCTS) break;
    const p = asRecord(item);
    if (!p) continue;
    const name = str(p.name, 120);
    if (!name) continue;
    products.push({
      id: str(p.id, 64) || makeId(),
      name,
      description: str(p.description, 600) || null,
      price_cents: Math.max(0, int(p.price_cents, 0)),
      category: str(p.category, 80) || null,
      image_url: str(p.image_url, 600) || null,
      unit: str(p.unit, 40) || "un",
      order: int(p.order, products.length),
      active: bool(p.active, true),
    });
  }

  products.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));

  return {
    enabled: bool(source.enabled, true),
    title: str(source.title, 80) || DEFAULT_MAIN_CATALOG.title,
    subtitle: str(source.subtitle, 200),
    whatsapp: str(source.whatsapp, 40),
    products,
  };
}

/** Monta o link wa.me a partir de um número (aceita "11999998888" ou "+55 11..."). */
export function buildWhatsAppLink(number: string, text: string): string | null {
  const digits = String(number || "").replace(/\D+/g, "");
  if (digits.length < 10) return null;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
