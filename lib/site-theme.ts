/**
 * TEMA DE CORES DO SITE PÚBLICO.
 *
 * - 3 combinações prontas: VERDE (padrão atual), ROXO (identidade doTERRA)
 *   e EUCALIPTO (verde-azulado botânico, terceira sugestão).
 * - O dono do site escolhe o tema em /painel/meu-site e pode ajustar a cor
 *   manualmente (uma cor primária → paleta derivada automaticamente).
 * - O VISITANTE também pode trocar a cor na HOME (seção "Escolha a cor"):
 *   fica salvo apenas no navegador/celular dele (localStorage), como uma
 *   amostra da personalização possível.
 *
 * Módulo puro (sem React/banco) — usado no servidor e no painel.
 */

export type ThemePresetKey = "verde" | "roxo" | "eucalipto";

export interface SiteThemeConfig {
  /** Combinação escolhida. Ausente = verde (padrão histórico). */
  preset?: ThemePresetKey;
  /**
   * Cor primária manual (#RRGGBB). Quando presente, tem prioridade sobre o
   * preset e a paleta é derivada automaticamente dela.
   */
  primary?: string | null;
}

export interface ThemePalette {
  /** cor principal (botões, títulos, fundos fortes) */
  main: string;
  /** tom médio (hovers, ícones) */
  medium: string;
  /** tom claro (detalhes, links) */
  light: string;
  /** tom bem claro (fundos suaves, chips) */
  soft: string;
  /** escuro (gradientes de fundo) */
  dark: string;
  /** mais escuro (fim dos gradientes) */
  darker: string;
}

export interface ThemePreset {
  key: ThemePresetKey;
  label: string;
  description: string;
  palette: ThemePalette;
}

/** Nomes das variáveis CSS em app/(site)/site.css que compõem o tema. */
const THEME_VAR_NAMES = [
  "--verde",
  "--verde-medio",
  "--verde-claro",
  "--verde-menta",
  "--verde-dark",
  "--verde-darker",
] as const;

/** Mapa de variáveis CSS de uma paleta (usado no servidor e no seletor do visitante). */
export function paletteToVars(p: ThemePalette): Record<string, string> {
  return {
    "--verde": p.main,
    "--verde-medio": p.medium,
    "--verde-claro": p.light,
    "--verde-menta": p.soft,
    "--verde-dark": p.dark,
    "--verde-darker": p.darker,
  };
}

// ------------------------------------------------------------- PRESETS ----

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: "verde",
    label: "Verde Natureza",
    description: "O verde clássico da plataforma — frescor e confiança.",
    palette: {
      main: "#1D5C3A",
      medium: "#2D7A4F",
      light: "#4A9E6B",
      soft: "#A8D5B5",
      dark: "#0D3320",
      darker: "#0A2418",
    },
  },
  {
    key: "roxo",
    label: "Roxo doTERRA",
    description: "Roxo profundo inspirado na identidade visual doTERRA.",
    palette: {
      main: "#5B2D86",
      medium: "#7143A3",
      light: "#9066C2",
      soft: "#D9C7EE",
      dark: "#2E1447",
      darker: "#1F0D33",
    },
  },
  {
    key: "eucalipto",
    label: "Eucalipto",
    description: "Verde-azulado botânico — sereno, como um spa de óleos.",
    palette: {
      main: "#14646B",
      medium: "#1E8087",
      light: "#41A3A9",
      soft: "#BEE0DF",
      dark: "#0B393D",
      darker: "#07272B",
    },
  },
];

export function getPreset(key: string | null | undefined): ThemePreset | null {
  return THEME_PRESETS.find((p) => p.key === key) || null;
}

function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(v);
  return m ? `#${m[1].toLowerCase()}` : null;
}

// --------------------------------------------------- DERIVAÇÃO MANUAL ----

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { h: 150, s: 50, l: 24 };
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(100, Math.max(0, s));
  const lig = Math.min(100, Math.max(0, l));
  const c = (1 - Math.abs((2 * lig) / 100 - 1)) * (sat / 100);
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig / 100 - c / 2;
  let rgb: [number, number, number];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`;
}

/**
 * Deriva a paleta completa a partir de UMA cor escolhida manualmente.
 * Mantém matiz/saturação e varia luminosidade — resultado sempre harmonioso.
 */
export function derivePalette(primary: string): ThemePalette {
  const base = normalizeHex(primary) || "#1D5C3A";
  const { h, s, l } = hexToHsl(base);
  return {
    main: hslToHex(h, s, l),
    medium: hslToHex(h, s, Math.min(l * 1.35, l + 12)),
    light: hslToHex(h, s, Math.min(l * 1.7, l + 26)),
    soft: hslToHex(h, Math.max(s * 0.75, 18), Math.min(l * 2.6 + 22, 84)),
    dark: hslToHex(h, s, Math.max(l * 0.42, 9)),
    darker: hslToHex(h, s, Math.max(l * 0.28, 6)),
  };
}

// ------------------------------------------------------------ RESOLUÇÃO ----

export interface ResolvedTheme {
  preset: ThemePresetKey;
  /** true quando veio de uma cor manual (siteTheme.primary) */
  custom: boolean;
  palette: ThemePalette;
}

/** Resolve a configuração salva no site_settings para uma paleta concreta. */
export function resolveSiteTheme(config?: SiteThemeConfig | null): ResolvedTheme {
  const primary = normalizeHex(config?.primary);
  if (primary) {
    return { preset: config?.preset || "verde", custom: true, palette: derivePalette(primary) };
  }
  const preset = getPreset(config?.preset) || THEME_PRESETS[0];
  return { preset: preset.key, custom: false, palette: preset.palette };
}

/** Mapa de variáveis CSS pronto para injetar em #tenant-site. */
export function themeCssVars(theme?: SiteThemeConfig | null): Record<string, string> {
  return paletteToVars(resolveSiteTheme(theme).palette);
}

/** Cor principal já resolvida (para meta theme-color e prévias). */
export function themePrimaryColor(theme?: SiteThemeConfig | null): string {
  return resolveSiteTheme(theme).palette.main;
}

/** Bloco <style> com as variáveis aplicadas ao site do usuário. */
export function themeStyleTag(theme?: SiteThemeConfig | null): string {
  const vars = themeCssVars(theme);
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `#tenant-site{${body}}`;
}

// ------------------------------------------------------- VISITANTE (LS) ----

/** Chave do localStorage do VISITANTE (escolha local, nunca vai pro servidor). */
export function visitorThemeStorageKey(slug: string): string {
  return `tema-site-${slug}`;
}
