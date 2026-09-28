/**
 * FONTES ÚNICAS DOS DOMÍNIOS DA PLATAFORMA.
 *
 * A plataforma atende consultores de venda direta (doTERRA, AMAKHA,
 * Tupperware, iGREEN e outras) — o domínio deixou de ser específico de
 * óleos essenciais.
 *
 *   DOMÍNIO PRINCIPAL (novo):   site.topconsultores.com.br
 *   DOMÍNIO LEGADO (preservado): oleos.topconsultores.com.br
 *
 * IMPORTANTE — compatibilidade:
 *  - O domínio legado NÃO pode ser desligado: sites, links de afiliados,
 *    cookies (`tc_visitor_token`), checkouts e webhooks do Mercado Pago já
 *    foram divulgados com ele. Os dois domínios servem a MESMA aplicação.
 *  - NUNCA faça redirect automático de `/{slug}` (sites dos usuários) entre
 *    domínios: cada URL de usuário deve continuar respondendo no host em
 *    que foi divulgada.
 *  - Qualquer código que precise saber "é domínio da plataforma?" deve usar
 *    `isPlatformHostname()` em vez de comparar com um host fixo.
 */

/** Domínio principal público da plataforma (novo posicionamento). */
export const PLATFORM_MAIN_DOMAIN = "site.topconsultores.com.br";

/** Domínios legados que continuam no ar por compatibilidade. */
export const PLATFORM_LEGACY_DOMAINS: readonly string[] = ["oleos.topconsultores.com.br"];

/** Domínio raiz (apex) da plataforma — subdomínios dele são da plataforma. */
export const PLATFORM_APEX_DOMAIN = "topconsultores.com.br";

function strip(host: string): string {
  return String(host || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0]
    .trim();
}

/** Hosts fixos da plataforma (principal + legados + envs conhecidas). */
export function getPlatformHosts(): string[] {
  const set = new Set<string>();
  set.add(PLATFORM_MAIN_DOMAIN);
  for (const legacy of PLATFORM_LEGACY_DOMAINS) set.add(legacy);
  for (const env of [process.env.NEXT_PUBLIC_HOME_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (env) {
      const h = strip(env);
      if (h) set.add(h);
    }
  }
  return Array.from(set);
}

/**
 * true quando o host pertence à plataforma (principal, legado ou qualquer
 * subdomínio do apex). Nesses hosts a requisição NUNCA resolve tenant por
 * domínio personalizado — o usuário é servido pelo caminho `/{slug}`.
 */
export function isPlatformHostname(host: string): boolean {
  const h = strip(host);
  if (!h) return false;
  if (h === PLATFORM_APEX_DOMAIN || h.endsWith("." + PLATFORM_APEX_DOMAIN)) return true;
  return getPlatformHosts().includes(h);
}

/** true para hosts técnicos que também não são domínio de tenant. */
export function isTechnicalHostname(host: string): boolean {
  const h = strip(host);
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".vercel.app") || h.endsWith(".local")) return true;
  return false;
}

/**
 * Host que NUNCA é domínio personalizado de tenant (plataforma ou técnico).
 * Usado pelo middleware e pelo resolvedor de PWA.
 */
export function isNonTenantHostname(host: string): boolean {
  return isTechnicalHostname(host) || isPlatformHostname(host);
}

/**
 * Origem pública da plataforma — usada como fallback em links absolutos
 * (afiliado), webhooks, SEO e textos visíveis.
 *
 * Prioridade (idêntica à anterior para não quebrar nada):
 *   1. NEXT_PUBLIC_HOME_URL  (domínio principal direcionado na Vercel)
 *   2. NEXT_PUBLIC_APP_URL   (URL da aplicação)
 *   3. https://site.topconsultores.com.br
 */
export function getPlatformOrigin(): string {
  const base =
    process.env.NEXT_PUBLIC_HOME_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${PLATFORM_MAIN_DOMAIN}`;
  return base.replace(/\/$/, "");
}
