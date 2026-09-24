import { resolvePwaForRequest } from "@/lib/pwa/resolver";
import sharp from "sharp";

export const dynamic = "force-dynamic";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Cache em memória por URL (a rota já responde Cache-Control: 1h; isto evita
// rebuscar/re-encodar o logo a cada request dentro da mesma instância).
const LOGO_DATA_URI_CACHE = new Map<string, string>();
const LOGO_DATA_URI_MAX = 30;

/**
 * Embute o logo do usuário DENTRO do SVG como data URI.
 *
 * POR QUE: quando o Chrome rasteriza um SVG (ícone do manifest/favicon), ele
 * usa o modo "imagem" — e nesse modo navegadores BLOQUEIAM recursos externos.
 * O <image href="https://...r2.dev/logo.png"> simplesmente não era desenhado,
 * e o ícone instalado virava um retângulo sólido da cor de tema, sem logotipo.
 * Com data URI o SVG é autossuficiente e sempre mostra a logo.
 */
async function logoDataUri(url: string, background: string): Promise<string | null> {
  const cached = LOGO_DATA_URI_CACHE.get(url);
  if (cached) return cached;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    let buf: Buffer;
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    } finally {
      clearTimeout(t);
    }
    if (!buf.length) return null;
    const png = await sharp(buf, { failOn: "none" })
      .flatten({ background })
      .resize(512, 512, { fit: "contain", background })
      .png({ compressionLevel: 9 })
      .toBuffer();
    if (!png.length) return null;
    const dataUri = `data:image/png;base64,${png.toString("base64")}`;
    while (LOGO_DATA_URI_CACHE.size >= LOGO_DATA_URI_MAX) {
      const oldest = LOGO_DATA_URI_CACHE.keys().next();
      if (oldest.done) break;
      LOGO_DATA_URI_CACHE.delete(oldest.value);
    }
    LOGO_DATA_URI_CACHE.set(url, dataUri);
    return dataUri;
  } catch {
    return null;
  }
}

/**
 * GET /{slug}/pwa/icon.svg
 * Ícone dinâmico do usuário: usa a logo (quando configurada) ou gera um
 * monograma com as cores da PWA. Usado como fallback no manifest e como
 * apple-touch-icon alternativo.
 */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const resolved = await resolvePwaForRequest({ slugParam: params.slug });
  if (!resolved || !resolved.settings.enabled) {
    return new Response("Not Found", { status: 404 });
  }

  const s = resolved.settings;
  const background = /^#[0-9a-fA-F]{6}$/.test(s.background_color)
    ? s.background_color
    : "#faf8f2";
  let svg: string;

  if (s.logo_url) {
    const dataUri = await logoDataUri(s.logo_url, background);
    if (dataUri) {
      // Logo embutida (autossuficiente) em fundo com a cor de tema.
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="${escapeXml(background)}"/>
<image href="${dataUri}" x="64" y="64" width="384" height="384" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
    } else {
      // Rede indisponível: mantém o href externo (melhor que monograma).
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="${escapeXml(background)}"/>
<image href="${escapeXml(s.logo_url)}" x="96" y="156" width="320" height="200" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
    }
  } else {
    const letter = (s.short_name || s.app_name || "A").trim().charAt(0).toUpperCase() || "A";
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${escapeXml(s.theme_color)}"/>
<stop offset="1" stop-color="${escapeXml(shade(s.theme_color, -24))}"/>
</linearGradient>
</defs>
<rect width="512" height="512" rx="96" fill="url(#g)"/>
<text x="256" y="340" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="280" font-weight="bold" fill="${escapeXml(s.background_color)}">${escapeXml(letter)}</text>
</svg>`;
  }

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

/** Escurece/clareia uma cor hex em ±pontos percentuais simples. */
function shade(hex: string, percent: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + Math.round(2.55 * percent));
  const g = clamp(((num >> 8) & 0xff) + Math.round(2.55 * percent));
  const b = clamp((num & 0xff) + Math.round(2.55 * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
