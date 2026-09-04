import type { ResolvedHomeSection } from "@/types";

/**
 * Destino final do visitante que chega por um link de afiliado.
 *
 * - `anchor`: id da seção para onde o scroll deve ir. Quando `null`, NÃO
 *   rola para nada (ex.: site não está ativo, ou não há seção comercial
 *   configurada).
 * - `fallback`: indica que o destino é uma página de fallback do sistema
 *   (ex.: site não ativado). Em conjunto com `anchor === null`, significa
 *   "não tente scroll, exiba a página de fallback renderizada pelo servidor".
 * - `label`: descrição legível (debug/UI) — não usada para lógica.
 */
export type AffiliateDestination =
  | { kind: "anchor"; anchor: string; label: string }
  | { kind: "none"; label: string };

export interface ResolveDestinationInput {
  /** Seções resolvidas da HOME (já filtradas por `enabled` quando aplicável). */
  sections: ResolvedHomeSection[];
  /** Estado de acesso do site. Quando !== "available", o site é fallback. */
  access: "available" | "suspended";
}

/**
 * Resolve qual seção o AffiliateAttribution deve levar o visitante
 * quando ele chega por um link de afiliado.
 *
 * Estratégia (em ordem de prioridade):
 *   1. Se `access !== "available"` → `none` (site não está no ar; exibe o
 *      fallback renderizado pelo servidor, sem scroll).
 *   2. Se a seção `pricing` está habilitada E vai renderizar o anchor
 *      `#planos` (oferta comercial OU plano manual) → `#planos`.
 *   3. Caso contrário, procura o MELHOR destino comercial disponível:
 *      a. `trustbar.buttonUrl` (se for um anchor interno, leva até lá)
 *      b. `hero.secondaryBtn.url` (se anchor interno)
 *      c. Primeira seção visível (não header/footer/pricing)
 *      d. `none` (HOME abre no topo)
 *
 * A função é PURA: não toca em cookies, não faz fetch. O AffiliateAttribution
 * recebe o destino via prop e age em cima dele no client.
 */
export function resolveAffiliateDestination(input: ResolveDestinationInput): AffiliateDestination {
  if (input.access !== "available") {
    return { kind: "none", label: "site indisponível" };
  }

  const visible = (input.sections || []).filter((s) => s.enabled);

  // 1) PRIORIDADE 1 — Planos/Oferta (anchor "planos")
  const pricing = visible.find((s) => s.type === "pricing");
  if (pricing) {
    const content = (pricing.content || {}) as Record<string, unknown>;
    const offer = content.offer as { activation_price_cents?: number } | null | undefined;
    const plans = (content.plans as unknown[] | undefined) || [];
    // A Pricing retorna null se não houver oferta comercial E não houver
    // planos manuais. Nesse caso, a seção existe no DOM mas não no anchor
    // `#planos`. Verificamos o que o componente renderizaria de fato.
    const hasRenderableContent = Boolean(offer) || plans.length > 0;
    if (hasRenderableContent) {
      return { kind: "anchor", anchor: "planos", label: "seção de planos" };
    }
  }

  // 2) PRIORIDADE 2 — Trustbar (Barra de destaque): CTA comercial do tenant
  const trustbar = visible.find((s) => s.type === "trustbar");
  if (trustbar) {
    const url = ((trustbar.content as Record<string, unknown>).buttonUrl as string | undefined) || "";
    const anchor = extractInternalAnchor(url);
    if (anchor) {
      return { kind: "anchor", anchor, label: "barra de destaque" };
    }
  }

  // 3) PRIORIDADE 3 — Hero (CTA secundário)
  const hero = visible.find((s) => s.type === "hero");
  if (hero) {
    const c = (hero.content || {}) as Record<string, unknown>;
    const secondaryUrl = ((c.secondaryBtn as { url?: string } | undefined)?.url) || "";
    const secondaryAnchor = extractInternalAnchor(secondaryUrl);
    if (secondaryAnchor) {
      return { kind: "anchor", anchor: secondaryAnchor, label: "CTA do hero" };
    }
    const primaryUrl = ((c.primaryBtn as { url?: string } | undefined)?.url) || "";
    const primaryAnchor = extractInternalAnchor(primaryUrl);
    if (primaryAnchor) {
      return { kind: "anchor", anchor: primaryAnchor, label: "CTA principal do hero" };
    }
  }

  // 4) PRIORIDADE 4 — Primeira seção visível que não seja header/footer
  const firstMeaningful = visible.find((s) => s.type !== "header" && s.type !== "footer");
  if (firstMeaningful) {
    return { kind: "anchor", anchor: firstMeaningful.anchor, label: `seção ${firstMeaningful.type}` };
  }

  // 5) Nenhum destino encontrado — fica no topo
  return { kind: "none", label: "topo da home" };
}

/**
 * Extrai o anchor de uma URL interna (ex.: "#planos" → "planos").
 * Retorna `null` para URLs externas (http://, https://), caminhos absolutos
 * (/checkout, /cadastro) ou strings vazias — nesses casos o AffiliateAttribution
 * não faz scroll.
 */
function extractInternalAnchor(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith("#")) return null;
  const anchor = trimmed.slice(1).trim();
  if (!anchor) return null;
  // Só caracteres válidos para id HTML
  if (!/^[A-Za-z0-9_\-:.]+$/.test(anchor)) return null;
  return anchor;
}
