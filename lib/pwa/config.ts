// Núcleo de configuração PWA — compartilhado entre rotas de servidor e painel.
// NÃO depende de banco nem de next/headers (testável e reutilizável).

export interface PwaSettings {
  tenant_id: string;
  user_id: string;
  enabled: boolean;
  app_name: string;
  short_name: string;
  description: string;
  logo_url: string | null;
  icon_192_url: string | null;
  icon_512_url: string | null;
  icon_180_url: string | null;
  icon_maskable_512_url: string | null;
  theme_color: string;
  background_color: string;
  canonical: "platform" | "custom";
  updated_at?: string;
}

export function defaultPwaSettings(tenantId = "", userId = ""): PwaSettings {
  return {
    tenant_id: tenantId,
    user_id: userId,
    enabled: false,
    app_name: "",
    short_name: "",
    description: "",
    logo_url: null,
    icon_192_url: null,
    icon_512_url: null,
    icon_180_url: null,
    icon_maskable_512_url: null,
    theme_color: "#1d5c3a",
    background_color: "#faf8f2",
    canonical: "platform",
  };
}

/** Configuração padrão usada na demonstração (/demonstracao não tem linha no banco). */
export const DEMO_PWA_SETTINGS: PwaSettings = {
  tenant_id: "demo-tenant",
  user_id: "demo-user",
  enabled: true,
  app_name: "Demonstração",
  short_name: "Demo",
  description: "App da consultora Demonstração — óleos essenciais e bem-estar.",
  logo_url: null,
  icon_192_url: null,
  icon_512_url: null,
  icon_180_url: null,
  icon_maskable_512_url: null,
  theme_color: "#1d5c3a",
  background_color: "#faf8f2",
  canonical: "platform",
};

export interface PwaUrlContext {
  /** Origem canônica, ex.: https://oleos.topconsultores.com.br ou domínio próprio */
  origin: string;
  /** Escopo/base do app: "/{slug}/" na plataforma; "/" em domínio próprio */
  basePath: string; // sempre com barras nas pontas
}

// ============================ VERSIONAMENTO & CACHE-BUSTING ============================
// Quando o usuário salva uma nova config (especialmente ícone), geramos um
// token `v=<timestamp>` que é:
//  - embutido no nome do cache do Service Worker (forçando revalidação);
//  - adicionado como query string nas URLs de `icons[]` do manifest;
//  - devolvido ao cliente para que o registro do SW use a versão nova.
// Resultado: ao trocar o ícone, o navegador é OBRIGADO a revalidar
// manifest + ícones — não fica preso no cache do app instalado.

export function pwaVersionToken(s: PwaSettings): string {
  // `updated_at` é gravado pela API no PUT. Se não existir (defaults), usa timestamp determinístico.
  if (s.updated_at) {
    // formato curto: pega a parte de segundos e converte para base36
    const ts = new Date(s.updated_at).getTime();
    if (!Number.isNaN(ts) && ts > 0) return ts.toString(36);
  }
  return "1";
}

function withVersion(url: string, v: string): string {
  if (!url) return url;
  // URLs absolutas: usa URL API (preserva origem).
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      u.searchParams.set("v", v);
      return u.toString();
    } catch {
      return url;
    }
  }
  // URLs relativas (/...): injeta/atualiza ?v= manualmente SEM trocar a origem.
  // (Bug antigo: new URL(rel, "https://placeholder.local") vazava o host
  // placeholder para o manifest → ícone quebrado no celular.)
  try {
    const hashIdx = url.indexOf("#");
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
    const withoutHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
    const qIdx = withoutHash.indexOf("?");
    const path = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
    const params = new URLSearchParams(qIdx >= 0 ? withoutHash.slice(qIdx + 1) : "");
    params.set("v", v);
    return `${path}?${params.toString()}${hash}`;
  } catch {
    return url;
  }
}

/** URLs PWA derivadas do basePath ("/" na HOME/domínio próprio; "/{slug}/" na plataforma). */
export function pwaUrls(basePath: string): {
  manifestUrl: string;
  swUrl: string;
  iconUrl: string;
} {
  const manifestUrl =
    basePath === "/" ? "/manifest.webmanifest" : `${basePath}manifest.webmanifest`;
  const swUrl = basePath === "/" ? "/sw.js" : `${basePath}sw.js`;
  const iconUrl = `${basePath}pwa/icon.svg`;
  return { manifestUrl, swUrl, iconUrl };
}

function joinOrigin(origin: string, path: string) {
  return `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Caminhos (relativos) dos ícones PNG servidos pelo PRÓPRIO domínio.
 *
 * Arquitetura "100% à prova de logo quebrado":
 * - As rotas `/pwa/icon-192.png`, `/pwa/icon-512.png`,
 *   `/pwa/icon-maskable-512.png` e `/pwa/apple-touch-icon.png` (na raiz em
 *   domínio próprio/HOME ou em `/{slug}/pwa/...` na plataforma) fazem proxy
 *   do upload do usuário (normalizado em tamanho exato via sharp) ou geram
 *   um tile PNG com a identidade do app quando não há upload.
 * - Manifest e <head> referenciam SEMPRE essas URLs same-origin → zero CORS,
 *   zero URL quebrada, tamanho exato garantido no Android e no iOS.
 */
export function pwaIconPaths(basePath: string): {
  icon192: string;
  icon512: string;
  maskable: string;
  apple: string;
} {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return {
    icon192: `${base}pwa/icon-192.png`,
    icon512: `${base}pwa/icon-512.png`,
    maskable: `${base}pwa/icon-maskable-512.png`,
    apple: `${base}pwa/apple-touch-icon.png`,
  };
}

/**
 * Monta o manifest dinâmico do usuário.
 * - start_url/scope respeitam a origem de acesso
 * - icons SEMPRE inclui PNGs 180/192/512 (any) + 512 maskable servidos pelo
 *   próprio domínio (proxy normalizado — nunca quebra, nunca sofre CORS),
 *   com `?v=<token>` para forçar revalidação quando o usuário trocar o ícone.
 * - fallback SVG (monograma) por último, para navegadores que o aceitam.
 */
export function buildManifest(
  s: PwaSettings,
  ctx: PwaUrlContext
): Record<string, unknown> {
  const scopeBase = ctx.basePath.endsWith("/") ? ctx.basePath : `${ctx.basePath}/`;
  const name = s.app_name || "Meu Aplicativo";
  const shortName = s.short_name || name.slice(0, 12);
  const v = pwaVersionToken(s);
  const paths = pwaIconPaths(scopeBase);
  const absV = (rel: string) => abs(withVersion(rel, v), ctx.origin);

  const icons: Record<string, unknown>[] = [
    // iOS também lê o manifest em alguns fluxos — 180 first.
    { src: absV(paths.apple), sizes: "180x180", type: "image/png", purpose: "any" },
    // Android: 192×192 (mínimo histórico, manifest spec)
    { src: absV(paths.icon192), sizes: "192x192", type: "image/png", purpose: "any" },
    // Android: 512×512 (splash + home screen em alta densidade)
    { src: absV(paths.icon512), sizes: "512x512", type: "image/png", purpose: "any" },
    // Android: 512×512 maskable — safe zone de 80% gerada no servidor.
    { src: absV(paths.maskable), sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];

  // Fallback SVG (monograma do app) — Chrome e Edge aceitam `any maskable`.
  const svgIcon = joinOrigin(ctx.origin, `${scopeBase}pwa/icon.svg`);
  icons.push({
    src: svgIcon,
    sizes: "any",
    type: "image/svg+xml",
    purpose: "any maskable",
  });

  return {
    id: joinOrigin(ctx.origin, scopeBase),
    name,
    short_name: shortName,
    description: s.description || `Aplicativo ${name}`,
    start_url: scopeBase,
    scope: scopeBase,
    display: "standalone",
    orientation: "portrait",
    theme_color: s.theme_color,
    background_color: s.background_color,
    lang: "pt-BR",
    dir: "ltr",
    icons,
  };
}

function abs(url: string, origin: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return joinOrigin(origin, url);
}

// ------------------------------------------------------------ STATUS ----

export interface PwaChecklist {
  nome: boolean;
  logo: boolean;
  icone: boolean;
  cores: boolean;
  manifest: boolean;
  serviceWorker: boolean;
  ativa: boolean;
  iconesIgualados: boolean;
}

export interface PwaStatus {
  level: "configured" | "ready" | "incomplete";
  label: string;
  checks: PwaChecklist;
}

export function computePwaStatus(s: PwaSettings): PwaStatus {
  const iconUrls = [
    s.icon_180_url,
    s.icon_192_url,
    s.icon_512_url,
    s.icon_maskable_512_url,
  ];
  const iconesIgualados = iconUrls.filter(
    (u, i) => u && iconUrls.every((v) => v === u)
  ).length > 0;
  const checks: PwaChecklist = {
    nome: Boolean(s.app_name && s.short_name),
    logo: Boolean(s.logo_url),
    icone: Boolean(s.icon_192_url || s.icon_512_url || s.icon_180_url),
    cores: Boolean(s.theme_color && s.background_color),
    manifest: Boolean(s.app_name),
    serviceWorker: true, // servido automaticamente quando a PWA está ativa
    ativa: s.enabled,
    iconesIgualados,
  };
  const essentials =
    checks.nome && checks.cores && checks.manifest && checks.ativa;
  let level: PwaStatus["level"] = "incomplete";
  let label = "PWA INCOMPLETA";
  if (!s.enabled) {
    level = "incomplete";
    label = "PWA INCOMPLETA";
  } else if (essentials && checks.logo && (s.icon_192_url || s.icon_512_url)) {
    level = "configured";
    label = "PWA CONFIGURADA";
  } else if (essentials) {
    level = "ready";
    label = "PWA PRONTA PARA INSTALAÇÃO";
  }
  return { level, label, checks };
}
