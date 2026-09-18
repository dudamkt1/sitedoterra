import sharp from "sharp";
import type { PwaSettings } from "./config";
import { r2Env } from "@/lib/r2";

// Renderização GARANTIDA do ícone PNG do PWA (server-side).
//
// O celular (Android/iOS) só mostra o logotipo se receber um PNG válido,
// quadrado, opaco e acessível sem CORS. Esta função garante isso:
//  1. Tenta servir a variante pré-gerada correspondente (já enviada pelo
//     cliente com o tamanho exato) via proxy direto do R2 — sem Sharp.
//  2. Usa o melhor upload do usuário (512 → maskable → 192 → 180 → logo),
//     normalizado para o tamanho exato com fundo da cor do tema.
//  3. Se não houver upload (ou o download falhar), gera um tile PNG com a
//     identidade do app (gradiente + gota, SEM fontes — funciona em
//     qualquer ambiente, inclusive Vercel/Lambda sem fontes do sistema).
//
// As rotas `/pwa/*.png` (raiz e `/{slug}/pwa/*.png`) servem este buffer no
// MESMO domínio do site → o manifest nunca quebra por CORS do R2/CDN.

// Fail-fast com retry: timeout por tentativa + backoff. R2/CDN saudável
// responde em <1s; 15s total com 3 tentativas cobre latência + retry.
const FETCH_TIMEOUT_MS = 15_000;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_FETCH_RETRIES = 3;

export type PwaPngKind = "apple" | "icon192" | "icon512" | "maskable";

const KIND_SIZE: Record<PwaPngKind, number> = {
  apple: 180,
  icon192: 192,
  icon512: 512,
  maskable: 512,
};

const KIND_URL_FIELD: Record<PwaPngKind, keyof PwaSettings> = {
  apple: "icon_180_url",
  icon192: "icon_192_url",
  icon512: "icon_512_url",
  maskable: "icon_maskable_512_url",
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

/**
 * Tenta buscar a imagem com retry e fallback de URL.
 * - Timeout por tentativa: FETCH_TIMEOUT_MS
 * - Retry com backoff exponencial: MAX_FETCH_RETRIES tentativas
 * - Se URL usa domínio customizado (R2_PUBLIC_URL), tenta fallback para .r2.dev
 */
async function fetchSource(url: string): Promise<Buffer | null> {
  // Gera URLs alternativas: se é domínio customizado, tenta .r2.dev como fallback
  const urlsToTry = getAlternativeUrls(url);

  for (let attempt = 0; attempt < urlsToTry.length; attempt++) {
    const currentUrl = urlsToTry[attempt];
    const isFallback = attempt > 0;
    const maxRetries = isFallback ? 1 : MAX_FETCH_RETRIES; // fallback URL tenta só 1x

    for (let retry = 0; retry < maxRetries; retry++) {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(currentUrl, {
          signal: ctrl.signal,
          redirect: "follow",
          cache: "no-store",
          headers: {
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 (PWA-Icon-Renderer)",
          },
        });
        if (!res.ok) {
          const errMsg = `HTTP ${res.status}`;
          if (retry === maxRetries - 1 && attempt === urlsToTry.length - 1) {
            console.error(`[pwa/icon] fetchSource falhou após ${maxRetries} tentativas: url=${currentUrl} ${errMsg}`);
          } else {
            console.warn(`[pwa/icon] fetchSource ${errMsg} (tentativa ${retry + 1}/${maxRetries}): url=${currentUrl}`);
          }
          continue; // retry
        }
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (!ct.startsWith("image/") && !/\.svg($|\?)/i.test(currentUrl)) {
          console.warn(`[pwa/icon] fetchSource content-type inesperado (aceitando): url=${currentUrl} ct=${ct || "(ausente)"}`);
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.length || buf.length > MAX_SOURCE_BYTES) {
          console.error(
            `[pwa/icon] fetchSource tamanho inválido: url=${currentUrl} bytes=${buf.length} max=${MAX_SOURCE_BYTES}`
          );
          continue; // retry next URL
        }
        if (isFallback) {
          console.log(`[pwa/icon] fetchSource SUCESSO via fallback .r2.dev: url=${currentUrl}`);
        }
        return buf;
      } catch (err) {
        const isLastAttempt = retry === maxRetries - 1 && attempt === urlsToTry.length - 1;
        const msg = isLastAttempt ? "FALHA FINAL" : `tentativa ${retry + 1}/${maxRetries}`;
        console.error(`[pwa/icon] fetchSource ${msg}: url=${currentUrl}`, err);
        if (!isLastAttempt) {
          // Backoff exponencial: 500ms, 1s, 2s...
          await new Promise((r) => setTimeout(r, 500 * 2 ** retry));
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  }
  return null;
}

function getAlternativeUrls(url: string): string[] {
  const urls = [url];
  try {
    const u = new URL(url);
    const host = u.hostname;
    const isR2Native = host.endsWith(".r2.dev") || host.endsWith(".cloudflarestorage.com");
    if (!isR2Native) {
      const env = r2Env();
      const bucket = env.bucket || "site-doterra-media";
      const fallbackUrl = `https://${bucket}.r2.dev${u.pathname}${u.search}`;
      if (fallbackUrl !== url) urls.push(fallbackUrl);
    }
  } catch {
    // URL inválida, usa só a original
  }
  return urls;
}

/**
 * Tenta servir a variante pré-gerada diretamente do R2 via proxy.
 * Retorna o buffer se bem-sucedido, null caso contrário.
 */
async function tryProxyPreGeneratedVariant(
  settings: PwaSettings,
  kind: PwaPngKind
): Promise<Buffer | null> {
  const urlField = KIND_URL_FIELD[kind];
  const variantUrl = settings[urlField];
  if (!variantUrl || typeof variantUrl !== "string" || !variantUrl.trim()) {
    return null;
  }

  const urlsToTry = getAlternativeUrls(variantUrl);

  for (let attempt = 0; attempt < urlsToTry.length; attempt++) {
    const currentUrl = urlsToTry[attempt];
    const isFallback = attempt > 0;
    const maxRetries = isFallback ? 1 : MAX_FETCH_RETRIES;

    for (let retry = 0; retry < maxRetries; retry++) {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(currentUrl, {
          signal: ctrl.signal,
          redirect: "follow",
          cache: "no-store",
          headers: {
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 (PWA-Icon-Renderer)",
          },
        });
        if (!res.ok) {
          const errMsg = `HTTP ${res.status}`;
          if (retry === maxRetries - 1 && attempt === urlsToTry.length - 1) {
            console.warn(
              `[pwa/icon] proxy pré-gerado falhou após ${maxRetries} tentativas: url=${currentUrl} ${errMsg}`
            );
          } else {
            console.warn(
              `[pwa/icon] proxy pré-gerado ${errMsg} (tentativa ${retry + 1}/${maxRetries}): url=${currentUrl}`
            );
          }
          continue;
        }
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (!ct.startsWith("image/")) {
          console.warn(
            `[pwa/icon] proxy pré-gerado content-type inesperado: url=${currentUrl} ct=${ct || "(ausente)"}`
          );
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.length || buf.length > MAX_SOURCE_BYTES) {
          console.error(
            `[pwa/icon] proxy pré-gerado tamanho inválido: url=${currentUrl} bytes=${buf.length} max=${MAX_SOURCE_BYTES}`
          );
          continue;
        }
        if (isFallback) {
          console.log(
            `[pwa/icon] proxy pré-gerado SUCESSO via fallback .r2.dev: url=${currentUrl}`
          );
        }
        return buf;
      } catch (err) {
        const isLastAttempt = retry === maxRetries - 1 && attempt === urlsToTry.length - 1;
        const msg = isLastAttempt ? "FALHA FINAL" : `tentativa ${retry + 1}/${maxRetries}`;
        console.error(`[pwa/icon] proxy pré-gerado ${msg}: url=${currentUrl}`, err);
        if (!isLastAttempt) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** retry));
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  }
  return null;
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

  // 1) PRIMEIRO: tenta servir a variante pré-gerada correspondente
  // (ex.: icon_512_url para kind=icon512). Isso evita re-processamento
  // desnecessário e garante que o ícone exato enviado pelo usuário seja servido.
  const preGenerated = await tryProxyPreGeneratedVariant(settings, kind);
  if (preGenerated) {
    return { buffer: preGenerated, generated: false };
  }

  // 2) FALLBACK: tenta os uploads do usuário (maior resolução primeiro)
  // e re-processa com Sharp para o tamanho exato.
  for (const src of sourceCandidates(settings)) {
    const absolute = absolutize(src, origin);
    // Evita loop: nunca busca de si mesma (rotas /pwa/*.png).
    if (/\/pwa\/(icon-192\.png|icon-512\.png|icon-maskable-512\.png|apple-touch-icon\.png)/.test(absolute)) {
      continue;
    }
    const input = await fetchSource(absolute);
    if (!input) continue;
    try {
      // Full-bleed INTENCIONAL (inclusive maskable): a arte enviada pelo
      // usuário já é o ícone final quadrado. Encolher para "safe zone" criava
      // moldura de cor diferente do fundo do logo — e o Android usa justamente
      // o maskable na tela inicial ("logo diferente" no app instalado).
      // Bordas full-bleed têm a cor do próprio fundo do logo → o recorte do
      // launcher (círculo/squircle) fica invisível e o ícone é IDÊNTICO ao
      // enviado em todos os tamanhos e launchers.
      const pipeline = sharp(input, { failOn: "none" })
        .flatten({ background: theme })
        .resize(size, size, { fit: "contain", background: theme });
      const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      return { buffer, generated: false };
    } catch (err) {
      // Fonte corrompida ou formato não suportado? Loga e tenta a próxima.
      console.error(`[pwa/icon] renderPwaPng sharp falhou: url=${absolute} kind=${kind}`, err);
      continue;
    }
  }

  // 3) Fallback final: tile gerado com a identidade do app (sempre funciona).
  const svg = fallbackSvg(settings);
  const buffer = await sharp(Buffer.from(svg))
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { buffer, generated: true };
}
