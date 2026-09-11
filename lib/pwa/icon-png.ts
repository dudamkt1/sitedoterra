import sharp from "sharp";
import type { PwaSettings } from "./config";

// Renderização GARANTIDA do ícone PNG do PWA (server-side).
//
// O celular (Android/iOS) só mostra o logotipo se receber um PNG válido,
// quadrado, opaco e acessível sem CORS. Esta função garante isso:
//  1. Usa o melhor upload do usuário (512 → maskable → 192 → 180 → logo),
//     normalizado para o tamanho exato com fundo da cor do tema.
//  2. Se não houver upload (ou o download falhar), gera um tile PNG com a
//     identidade do app (gradiente + gota, SEM fontes — funciona em
//     qualquer ambiente, inclusive Vercel/Lambda sem fontes do sistema).
//
// As rotas `/pwa/*.png` (raiz e `/{slug}/pwa/*.png`) servem este buffer no
// MESMO domínio do site → o manifest nunca quebra por CORS do R2/CDN.

const FETCH_TIMEOUT_MS = 12_000;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export type PwaPngKind = "apple" | "icon192" | "icon512" | "maskable";

const KIND_SIZE: Record<PwaPngKind, number> = {
  apple: 180,
  icon192: 192,
  icon512: 512,
  maskable: 512,
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shade(hex: string, percent: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const amt = Math.round(2.55 * percent);
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Tile de fallback 100% vetorial (sem <text> — sem dependência de fontes). */
function fallbackSvg(s: PwaSettings): string {
  const theme = /^#[0-9a-fA-F]{6}$/.test(s.theme_color) ? s.theme_color : "#1d5c3a";
  const dark = shade(theme, -24);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${escapeXml(theme)}"/>
<stop offset="1" stop-color="${escapeXml(dark)}"/>
</linearGradient>
</defs>
<rect width="512" height="512" fill="url(#g)"/>
<path d="M256 108 C206 196 152 268 152 340 a104 104 0 0 0 208 0 C360 268 306 196 256 108 Z" fill="#ffffff" opacity="0.96"/>
<ellipse cx="218" cy="330" rx="26" ry="40" fill="#ffffff" opacity="0.28"/>
</svg>`;
}

/** Ordena fontes da melhor para a pior (maior resolução primeiro). */
function sourceCandidates(s: PwaSettings): string[] {
  return [
    s.icon_512_url,
    s.icon_maskable_512_url,
    s.icon_192_url,
    s.icon_180_url,
    s.logo_url,
  ].filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}

function absolutize(url: string, origin: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}

async function fetchSource(url: string): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    // SVG como fonte também vale (sharp rasteriza via librsvg).
    if (!ct.startsWith("image/") && !/\.svg($|\?)/i.test(url)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_SOURCE_BYTES) return null;
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Renderiza o PNG final do ícone.
 * Sempre devolve um PNG válido — nunca lança para o chamador tratar como
 * "sem ícone" (em último caso, o tile de fallback).
 */
export async function renderPwaPng(
  settings: PwaSettings,
  kind: PwaPngKind,
  origin: string
): Promise<{ buffer: Buffer; generated: boolean }> {
  const size = KIND_SIZE[kind];
  const theme = /^#[0-9a-fA-F]{6}$/.test(settings.theme_color)
    ? settings.theme_color
    : "#1d5c3a";

  // 1) Tenta os uploads do usuário (maior resolução primeiro).
  for (const src of sourceCandidates(settings)) {
    const absolute = absolutize(src, origin);
    // Evita loop: nunca busca de si mesma (rotas /pwa/*.png).
    if (/\/pwa\/(icon-192\.png|icon-512\.png|icon-maskable-512\.png|apple-touch-icon\.png)/.test(absolute)) {
      continue;
    }
    const input = await fetchSource(absolute);
    if (!input) continue;
    try {
      let pipeline = sharp(input, { failOn: "none" }).flatten({ background: theme });
      if (kind === "maskable") {
        // Safe zone 80%: conteúdo centralizado com padding do tema.
        const safe = Math.round(size * 0.8);
        pipeline = pipeline.resize(safe, safe, {
          fit: "contain",
          background: theme,
        });
        pipeline = pipeline.extend({
          top: Math.floor((size - safe) / 2),
          bottom: Math.ceil((size - safe) / 2),
          left: Math.floor((size - safe) / 2),
          right: Math.ceil((size - safe) / 2),
          background: theme,
        });
      } else {
        // Contain (não corta logos retangulares) + fundo opaco do tema.
        pipeline = pipeline.resize(size, size, { fit: "contain", background: theme });
      }
      const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      return { buffer, generated: false };
    } catch {
      // Fonte corrompida? Tenta a próxima.
      continue;
    }
  }

  // 2) Fallback: tile gerado com a identidade do app (sempre funciona).
  const svg = fallbackSvg(settings);
  const buffer = await sharp(Buffer.from(svg))
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { buffer, generated: true };
}
