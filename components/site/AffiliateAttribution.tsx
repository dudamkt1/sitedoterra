"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { AffiliateDestination } from "@/lib/affiliate-destination";

/**
 * Captura o parâmetro `?ref=<userId>` da URL, dispara o registro de click no
 * sistema de afiliados, persiste o visitor_token em cookie first-party e
 * garante que o visitante seja levado até o destino correto da HOME.
 *
 * O destino é resolvido **no servidor** (`resolveAffiliateDestination`) e
 * passado via prop `destination`:
 *
 *   - `kind: "anchor"` → scroll suave até `#${destination.anchor}`
 *     (caso normal: `#planos`, mas pode ser qualquer outro anchor se a
 *     seção de planos não existir no momento).
 *   - `kind: "none"`   → não faz scroll (ex.: site não está ativo e o
 *     servidor já renderizou uma página de fallback).
 *
 * O AffiliateAttribution NÃO decide onde ir; ele APENAS executa o destino
 * que o servidor escolheu. Isso garante que o sistema use a configuração
 * REAL do site naquele momento (seções habilitadas, site ativo, etc) e
 * que o link de afiliado **nunca dependa** de uma seção específica estar
 * presente.
 *
 * Mecanismo de atribuição:
 *   - Cookie first-party `tc_visitor_token` (180 dias) é a fonte de
 *     verdade entre páginas e até o checkout.
 *   - O `POST /api/affiliate/click` é chamado IMEDIATAMENTE após detectar
 *     `?ref=`, antes mesmo do scroll. Assim, mesmo que o visitante
 *     feche a aba durante o scroll, a atribuição fica registrada.
 *   - A função SQL `register_affiliate_click` aplica a regra
 *     **first-click wins** já existente.
 */
export function AffiliateAttribution({
  destination,
  siteHomeSelector = "#tenant-site",
  children,
}: {
  destination: AffiliateDestination;
  siteHomeSelector?: string;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;

    const key = `${pathname}:${ref}`;
    if (handledRef.current === key) return;

    // Validação leve no cliente (formato UUID); servidor faz validação forte.
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(ref)) {
      return;
    }

    handledRef.current = key;

    let cancelled = false;

    const subdomain = typeof window !== "undefined" ? window.location.host : "unknown";

    // 1) Registra o click IMEDIATAMENTE — antes de qualquer scroll, navegação
    //    ou mudança de URL. Isso garante que a atribuição fique preservada
    //    mesmo se o visitante fechar a aba durante o scroll, ou se o destino
    //    for "none" (página de fallback).
    fetch("/api/affiliate/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, subdomain }),
      credentials: "include",
    })
      .catch(() => {
        // Falha silenciosa: nunca quebra a HOME. O cookie de visitor_token
        // continua sendo gerado pelo servidor no caminho feliz, e o
        // link do afiliado permanece preservado pelo cookie.
      })
      .finally(() => {
        if (cancelled) return;

        // 2) Limpa a query string para não expor o `ref` ad infinitum.
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("ref");
          window.history.replaceState(
            null,
            "",
            url.pathname + (url.search ? url.search : "") + url.hash
          );
        } catch {
          // ignora
        }

        // 3) Navega para o destino resolvido pelo servidor.
        if (destination.kind === "anchor") {
          scrollToAnchor(destination.anchor, siteHomeSelector);
        }
        // kind === "none": site indisponível, sem scroll. O servidor já
        // renderizou a página de fallback apropriada.
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, searchParams, destination, siteHomeSelector]);

  return <>{children}</>;
}

/**
 * Tenta rolar até `#<anchor>` repetidamente até que o elemento exista.
 * Aguarda o container principal da HOME aparecer (evita scroll prematuro
 * em páginas com skeletons / seções com lazy load) e depois faz polling
 * pelo anchor com timeout de ~6s. Funciona em desktop e mobile.
 */
function scrollToAnchor(anchor: string, containerSelector: string): void {
  const hash = `#${anchor}`;
  let attempts = 0;
  const maxAttempts = 60; // até ~6s

  function tryScroll() {
    attempts += 1;
    const el = document.querySelector(hash) as HTMLElement | null;
    if (el) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        try {
          window.scrollTo({ top: el.offsetTop, behavior: "smooth" });
        } catch {
          window.scrollTo(0, el.offsetTop);
        }
      }
      try {
        if (window.location.hash !== hash) {
          window.history.replaceState(null, "", hash);
        }
      } catch {
        // ignora
      }
      return;
    }
    if (attempts < maxAttempts) {
      window.setTimeout(tryScroll, 100);
    }
  }

  function waitForContainer() {
    const container = document.querySelector(containerSelector);
    if (container || attempts > 5) {
      tryScroll();
      return;
    }
    attempts += 1;
    window.setTimeout(waitForContainer, 100);
  }

  waitForContainer();
}
