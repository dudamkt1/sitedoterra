import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicTenantByDomain, getPublicTenantBySlug } from "@/lib/tenant";
import {
  DEMO_PWA_SETTINGS,
  defaultPwaSettings,
  type PwaSettings,
} from "./config";

/**
 * RESOLUÇÃO CENTRAL DO USUÁRIO ATUAL (PWA).
 *
 * Arquitetura: rota dinâmica /{slug} no domínio principal
 * (oleos.topconsultores.com.br/demonstracao) + domínio próprio opcional
 * (joaoconsultor.com.br → mesmo perfil). NUNCA subdomínios.
 */
export interface CurrentUserRef {
  /** slug identificador (ex.: "demonstracao"); null quando não identificado */
  slug: string | null;
  /** true quando o acesso veio de um domínio próprio verificado */
  isCustomDomain: boolean;
  /** origem do acesso, ex.: https://oleos.topconsultores.com.br */
  origin: string;
}

function normalizeHost(h: string): string {
  return h
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0];
}

function mainHosts(): string[] {
  const list: string[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (appUrl) list.push(normalizeHost(appUrl));
  const homeUrl = process.env.NEXT_PUBLIC_HOME_URL || "";
  if (homeUrl) list.push(normalizeHost(homeUrl));
  return list.filter(Boolean);
}

export function isMainHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h || h === "localhost" || h.endsWith(".vercel.app") || h.endsWith(".local")) return true;
  return mainHosts().includes(h);
}

/** Lê host/origem dos headers da requisição atual. */
export async function getRequestOrigin(): Promise<{ host: string; origin: string }> {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return { host, origin: `${proto}://${host}` };
}

/**
 * Identifica o usuário atual:
 *  - domínio principal + rota → usa o parâmetro {slug}
 *  - domínio próprio         → consulta RPC get_public_tenant_by_domain
 */
export async function resolveCurrentUser(opts?: {
  slugParam?: string | null;
}): Promise<CurrentUserRef> {
  const { host, origin } = await getRequestOrigin();

  if (!isMainHost(host)) {
    const tenant = await getPublicTenantByDomain(host);
    return {
      slug: tenant?.slug ?? null,
      isCustomDomain: true,
      origin,
    };
  }

  return { slug: opts?.slugParam ?? null, isCustomDomain: false, origin };
}

// ------------------------------------------------------- SETTINGS ----

async function fetchSettingsByTenantId(tenantId: string): Promise<PwaSettings | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("pwa_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    return (data as PwaSettings) || null;
  } catch {
    return null;
  }
}

export interface ResolvedPwa {
  ref: CurrentUserRef;
  settings: PwaSettings;
  /** basePath com barras: "/{slug}/" na plataforma; "/" em domínio próprio */
  basePath: string;
}

/**
 * Resolve usuário + configurações PWA para as rotas dinâmicas
 * (manifest, ícones, service worker, metadata das páginas públicas).
 *
 * - /demonstracao usa defaults embutidos (não existe linha no banco).
 * - Domínio próprio sem identificação → null.
 */
export async function resolvePwaForRequest(opts?: {
  slugParam?: string | null;
}): Promise<ResolvedPwa | null> {
  const ref = await resolveCurrentUser(opts);
  if (!ref.slug) return null;

  // Demonstração: ambiente local do visitante — manifest com identidade padrão.
  if (ref.slug === "demonstracao") {
    return {
      ref,
      settings: { ...DEMO_PWA_SETTINGS },
      basePath: ref.isCustomDomain ? "/" : "/demonstracao/",
    };
  }

  const tenant = await getPublicTenantBySlug(ref.slug);
  if (!tenant) return null;

  const row = await fetchSettingsByTenantId(tenant.tenant_id);
  const settings: PwaSettings = row
    ? { ...defaultPwaSettings(tenant.tenant_id), ...row }
    : defaultPwaSettings(tenant.tenant_id);

  return {
    ref,
    settings,
    basePath: ref.isCustomDomain ? "/" : `/${ref.slug}/`,
  };
}
