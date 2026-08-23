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

function joinOrigin(origin: string, path: string) {
  return `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Monta o manifest dinâmico do usuário.
 * start_url/scope respeitam a origem de acesso:
 *  - plataforma → /{slug}/
 *  - domínio próprio → /
 */
export function buildManifest(
  s: PwaSettings,
  ctx: PwaUrlContext
): Record<string, unknown> {
  const scopeBase = ctx.basePath.endsWith("/") ? ctx.basePath : `${ctx.basePath}/`;
  const name = s.app_name || "Meu Aplicativo";
  const shortName = s.short_name || name.slice(0, 12);

  const icons: Record<string, unknown>[] = [];
  if (s.icon_192_url) {
    icons.push({ src: abs(s.icon_192_url, ctx.origin), sizes: "192x192", type: guessType(s.icon_192_url), purpose: "any" });
    icons.push({ src: abs(s.icon_192_url, ctx.origin), sizes: "192x192", type: guessType(s.icon_192_url), purpose: "maskable" });
  }
  if (s.icon_512_url) {
    icons.push({ src: abs(s.icon_512_url, ctx.origin), sizes: "512x512", type: guessType(s.icon_512_url), purpose: "any" });
    icons.push({ src: abs(s.icon_512_url, ctx.origin), sizes: "512x512", type: guessType(s.icon_512_url), purpose: "maskable" });
  }
  // Fallback: ícone SVG gerado dinamicamente (monograma/logo) — aceito pelo Chrome.
  const svgIcon = joinOrigin(ctx.origin, `${scopeBase}pwa/icon.svg`);
  icons.push({ src: svgIcon, sizes: "any", type: "image/svg+xml", purpose: "any maskable" });

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

function guessType(url: string): string {
  if (/\.png($|\?)/i.test(url)) return "image/png";
  if (/\.jpe?g($|\?)/i.test(url)) return "image/jpeg";
  if (/\.svg($|\?)/i.test(url)) return "image/svg+xml";
  if (/\.webp($|\?)/i.test(url)) return "image/webp";
  return "image/png";
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
}

export interface PwaStatus {
  level: "configured" | "ready" | "incomplete";
  label: string;
  checks: PwaChecklist;
}

export function computePwaStatus(s: PwaSettings): PwaStatus {
  const checks: PwaChecklist = {
    nome: Boolean(s.app_name && s.short_name),
    logo: Boolean(s.logo_url),
    icone: Boolean(s.icon_192_url || s.icon_512_url || true), // fallback SVG sempre existe
    cores: Boolean(s.theme_color && s.background_color),
    manifest: Boolean(s.app_name),
    serviceWorker: true, // servido automaticamente quando a PWA está ativa
    ativa: s.enabled,
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
