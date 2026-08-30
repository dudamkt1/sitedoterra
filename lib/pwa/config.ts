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
  // Mantém ?query string existente, mas injeta/atualiza o token v
  try {
    const u = new URL(url, "https://placeholder.local");
    u.searchParams.set("v", v);
    return u.toString();
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
 * Monta o manifest dinâmico do usuário.
 * - start_url/scope respeitam a origem de acesso
 * - icons inclui 192×192, 512×512 (any e maskable) e 180×180 (apple-touch)
 * - todas as URLs de imagem recebem `?v=<token>` para forçar revalidação
 *   quando o usuário trocar o ícone (cache-busting do SW do PWA).
 */
export function buildManifest(
  s: PwaSettings,
  ctx: PwaUrlContext
): Record<string, unknown> {
  const scopeBase = ctx.basePath.endsWith("/") ? ctx.basePath : `${ctx.basePath}/`;
  const name = s.app_name || "Meu Aplicativo";
  const shortName = s.short_name || name.slice(0, 12);
  const v = pwaVersionToken(s);

  // Origem de cada imagem: usa `icon_512_url` se houver, senão `icon_192_url`.
  // iOS/Android aceitam a mesma imagem servida em vários `sizes` — o que importa
  // é a proporção quadrada e qualidade visual.
  const iconSrc192 = s.icon_192_url || s.icon_512_url;
  const iconSrc512 = s.icon_512_url || s.icon_192_url;

  const icons: Record<string, unknown>[] = [];

  // Apple touch icon (iOS Safari)
  if (iconSrc192) {
    icons.push({
      src: abs(withVersion(iconSrc192, v), ctx.origin),
      sizes: "180x180",
      type: guessType(iconSrc192),
      purpose: "any",
    });
  }

  // Android: 192×192 (mínimo histórico, manifest spec)
  if (iconSrc192) {
    icons.push({
      src: abs(withVersion(iconSrc192, v), ctx.origin),
      sizes: "192x192",
      type: guessType(iconSrc192),
      purpose: "any",
    });
  }

  // Android: 512×512 (splash + home screen em alta densidade)
  if (iconSrc512) {
    icons.push({
      src: abs(withVersion(iconSrc512, v), ctx.origin),
      sizes: "512x512",
      type: guessType(iconSrc512),
      purpose: "any",
    });
  }

  // Android: 512×512 maskable — ícone preparado para safe zone; o Android
  // aplica máscara (squircle/círculo) automaticamente. Só declare se o usuário
  // tiver enviado uma imagem 512×512; nunca mascaramos imagens pequenas.
  if (iconSrc512) {
    icons.push({
      src: abs(withVersion(iconSrc512, v), ctx.origin),
      sizes: "512x512",
      type: guessType(iconSrc512),
      purpose: "maskable",
    });
  }

  // Fallback SVG (gerado dinamicamente, monograma do app) — Chrome e Edge
  // aceitam SVG com `any maskable` porque o SVG é vetorial e o navegador
  // cuida da máscara. Garante que mesmo sem upload o PWA ainda tem ícone.
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
