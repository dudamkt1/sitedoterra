/**
 * ANALYTICS DA PLATAFORMA (primeira-parte, sem cookies de terceiros).
 *
 * Regras centrais:
 *  - Só medimos o DOMÍNIO PRINCIPAL da plataforma (site.topconsultores.com.br
 *    e o legado oleos.topconsultores.com.br) e apenas as páginas PRÓPRIAS da
 *    plataforma (HOME, /checkout, /catalogo, /afiliados, /login, ...).
 *  - NUNCA medimos os sites dos usuários (/{slug} nem domínios próprios).
 *  - Hosts técnicos (localhost, *.vercel.app) são ignorados.
 *
 * A gravação em si é feita no middleware (`middleware.ts`), de forma
 * assíncrona — nenhum JavaScript é enviado ao visitante.
 */

import { isPlatformHostname, isTechnicalHostname } from "@/lib/platform-domain";

/**
 * Páginas da plataforma que entram na contagem. Qualquer caminho que comece
 * com um destes prefixos é considerado página da plataforma. Um slug de
 * usuário (`/{slug}`) nunca bate aqui (a não ser que o slug seja igual a uma
 * rota reservada — nesse caso a rota da plataforma é que é servida mesmo).
 */
export const PLATFORM_TRACKED_PATHS: readonly string[] = [
  "/",
  "/login",
  "/cadastro",
  "/signup",
  "/checkout",
  "/catalogo",
  "/afiliados",
  "/portfolio",
  "/privacidade",
  "/termos",
  "/cookies",
  "/landpage",
];

/** true quando o caminho é uma página própria da plataforma. */
export function isTrackablePlatformPath(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  return PLATFORM_TRACKED_PATHS.some(
    (base) => base !== "/" && (pathname === base || pathname.startsWith(base + "/"))
  );
}

/** true quando (host + caminho) deve ser contabilizado. */
export function isTrackableRequest(host: string, pathname: string): boolean {
  const h = (host || "").toLowerCase();
  if (!h) return false;
  if (isTechnicalHostname(h)) return false;
  if (!isPlatformHostname(h)) return false;
  return isTrackablePlatformPath(pathname);
}

export type DeviceType = "mobile" | "tablet" | "desktop" | "other";

/** Classifica o dispositivo pelo user-agent (heurística simples e barata). */
export function detectDevice(userAgent: string): DeviceType {
  const ua = (userAgent || "").toLowerCase();
  if (!ua) return "other";
  if (/ipad|tablet|playbook|silk|kindle|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod|windows phone|opera mini|iemobile|blackberry/.test(ua)) return "mobile";
  return "desktop";
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|preview|monitor|uptime|pingdom|lighthouse|pagespeed|headless|curl\/|wget|python-requests|python-urllib|go-http|java\/|axios|node-fetch|semrush|ahrefs|dotbot|petalbot|yandex|baidu|applebot|googlebot|duckduckbot|sogou|exabot|ia_archiver/i;

/** true quando o user-agent é de bot/robô (não conta como visita). */
export function isBot(userAgent: string): boolean {
  return BOT_PATTERN.test(userAgent || "");
}

const SOURCE_MATCHERS: readonly [RegExp, string][] = [
  [/google\./, "Google"],
  [/bing\./, "Bing"],
  [/(instagram\.com|instagr\.am)/, "Instagram"],
  [/(facebook\.com|fb\.me|fb\.com)/, "Facebook"],
  [/(whatsapp\.com|wa\.me|whatsapp\.net)/, "WhatsApp"],
  [/(tiktok\.com)/, "TikTok"],
  [/(youtube\.com|youtu\.be)/, "YouTube"],
  [/linkedin\./, "LinkedIn"],
  [/(twitter\.com|t\.co|x\.com)/, "Twitter/X"],
  [/pinterest\./, "Pinterest"],
  [/(t\.me|telegram)/, "Telegram"],
];

/**
 * Traduz o referrer para uma "origem de tráfego" legível.
 *  - sem referrer  → "direto"
 *  - mesmo host / plataforma → "interno"
 *  - buscador/rede conhecida → nome amigável
 *  - desconhecido → o próprio domínio
 */
export function referrerSource(referrer: string, currentHost: string): string {
  if (!referrer) return "direto";
  try {
    const url = new URL(referrer);
    const refHost = url.hostname.toLowerCase().replace(/^www\./, "");
    const own = (currentHost || "").toLowerCase().replace(/^www\./, "").split(":")[0];
    if (refHost === own || refHost.endsWith("." + own) || isPlatformHostname(refHost)) {
      return "interno";
    }
    for (const [re, name] of SOURCE_MATCHERS) {
      if (re.test(refHost)) return name;
    }
    return refHost;
  } catch {
    return "direto";
  }
}
