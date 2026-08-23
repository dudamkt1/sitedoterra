import { resolvePwaForRequest } from "@/lib/pwa/resolver";

export const dynamic = "force-dynamic";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  let svg: string;

  if (s.logo_url) {
    // Logo centralizada em fundo com a cor de tema.
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="${escapeXml(s.background_color)}"/>
<image href="${escapeXml(s.logo_url)}" x="96" y="156" width="320" height="200" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
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
