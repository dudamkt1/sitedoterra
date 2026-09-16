import "server-only";

/**
 * SERVIDOR — sanitização de SVG (defesa em profundidade anti-XSS).
 *
 * Contexto: o logo do site é exibido via `<img>` puro, onde o navegador NÃO
 * executa scripts do SVG por design. Mesmo assim, a URL pública do arquivo
 * pode ser aberta diretamente — então todo SVG que entra pelo upload passa
 * por esta limpeza antes de ir ao R2:
 *   - exige raiz `<svg` (rejeita HTML/arbitrário disfarçado de .svg);
 *   - rejeita DOCTYPE/ENTITY (XXE + "billion laughs");
 *   - remove `<script>`, `<foreignObject>`, handlers de animação com JS
 *     (`<handler>`, `<listener>`), processing instructions e comentários;
 *   - remove atributos de evento (`onload=`, `onclick=`, ...) e URLs
 *     `javascript:` / `data:text/html`.
 *
 * Best-effort sem dependências externas. Nunca lança: retorna
 * `{ ok: false }` quando o conteúdo não é um SVG aproveitável.
 */
export function sanitizeSvg(input: Buffer | string): { ok: boolean; svg: string } {
  const fail = { ok: false as const, svg: "" };
  let text: string;
  try {
    text = typeof input === "string" ? input : input.toString("utf8");
  } catch {
    return fail;
  }
  if (!text || text.length > 2 * 1024 * 1024) return fail;

  // Precisa parecer SVG de verdade (raiz <svg ...> ... </svg>).
  if (!/<svg[\s>]/i.test(text)) return fail;

  // DOCTYPE/ENTITY → XXE e billion laughs: rejeita o arquivo inteiro.
  if (/<!DOCTYPE/i.test(text) || /<!ENTITY/i.test(text)) return fail;

  let out = text;
  // Processing instructions (<?xml-stylesheet ...?> etc.) e comentários.
  out = out.replace(/<\?[\s\S]*?\?>/g, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  // Elementos perigosos inteiros.
  out = out.replace(/<script[\s\S]*?(?:<\/script\s*>|$)/gi, "");
  out = out.replace(/<foreignObject[\s\S]*?(?:<\/foreignObject\s*>|$)/gi, "");
  out = out.replace(/<handler[\s\S]*?(?:<\/handler\s*>|$)/gi, "");
  out = out.replace(/<listener[\s\S]*?(?:<\/listener\s*>|$)/gi, "");
  out = out.replace(/<import[\s\S]*?(?:<\/import\s*>|$)/gi, "");
  // Atributos de evento: onload=, onclick=, onbegin= (SMIL), etc.
  out = out.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // URLs javascript: / data:text/html em href/src/xlink:href.
  out = out.replace(
    /\s(?:href|xlink:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (m, a: string, b: string, c: string) => {
      const v = String(a ?? b ?? c ?? "").trim().toLowerCase();
      if (v.startsWith("javascript:") || v.startsWith("data:text/html")) return "";
      return m;
    }
  );
  // CSS inline com javascript:/expression( (estilo antigo do IE).
  out = out.replace(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (m, a: string, b: string) => {
    const v = String(a ?? b ?? "").toLowerCase();
    if (v.includes("javascript:") || v.includes("expression(")) return "";
    return m;
  });

  out = out.trim();
  if (!/<svg[\s>]/i.test(out) || !/<\/svg\s*>/i.test(out)) return fail;
  return { ok: true, svg: out };
}
