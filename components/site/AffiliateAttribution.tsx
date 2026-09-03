"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Captura o parâmetro `?ref=<userId>` da URL, dispara o registro de click no
 * sistema de afiliados, persiste o visitor_token em cookie first-party e
 * garante que o visitante seja levado até a seção `#planos`.
 *
 * Regras:
 * - Não conflita com fluxos que já têm ref (sempre lê o mais recente).
 * - Primeiro clique vence: a API /api/affiliate/click já implementa first-click
 *   wins via RPC `register_affiliate_click`.
 * - Cookie first-party `tc_visitor_token` é a fonte de verdade entre páginas
 *   e até o checkout (lido pelo /api/checkout e propagado para Stripe/MP).
 * - Validação de afiliado: feita no servidor (a função SQL valida status ativo).
 * - Após o registro, faz `replaceState` para limpar a query e navega para
 *   `#planos` de forma resiliente (espera renderização dinâmica).
 * - Se não houver `?ref=`, é no-op (preserva comportamento atual da HOME).
 */
export function AffiliateAttribution({
  siteHomeSelector = "#tenant-site",
  pricingAnchor = "planos",
  children,
}: {
  /** Seletor do container da HOME pública para detectar renderização. */
  siteHomeSelector?: string;
  /** Anchor (sem #) para onde o visitante será levado após registrar a atribuição. */
  pricingAnchor?: string;
  /** Elementos filhos — renderizados sem modificação. */
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;

    // Evita reprocessar o mesmo `ref` em re-renders
    const key = `${pathname}:${ref}`;
    if (handledRef.current === key) return;

    // Validação leve no cliente (formato UUID); servidor faz a validação forte.
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(ref)) {
      return;
    }

    handledRef.current = key;

    let cancelled = false;

    const subdomain = typeof window !== "undefined" ? window.location.host : "unknown";

    fetch("/api/affiliate/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, subdomain }),
      credentials: "include",
    })
      .catch(() => {
        // Falha silenciosa: nunca quebra a HOME; cookie de visitor_token também
        // é gerado pelo servidor ao processar o clique. Se a chamada falhar, o
        // link ainda leva para #planos.
      })
      .finally(() => {
        if (cancelled) return;

        // Limpa a query string para não expor o `ref` ad infinitum, mantendo o hash.
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("ref");
          window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
        } catch {
          // ignora
        }

        // Rola até a seção de planos respeitando renderização dinâmica.
        scrollToPricingSection(pricingAnchor, siteHomeSelector);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, searchParams, pricingAnchor, siteHomeSelector]);

  return <>{children}</>;
}

/**
 * Tenta rolar até `#<anchor>` repetidamente até que o elemento exista.
 * Funciona bem com seções renderizadas dinamicamente (pricing aparece
 * depois de carregar oferta comercial).
 */
function scrollToPricingSection(anchor: string, containerSelector: string): void {
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
      // Atualiza o hash para refletir a navegação (sem disparar reload).
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

  // Aguarda a renderização do container principal da HOME antes de iniciar
  // a busca pelo anchor — evita scroll prematuro em páginas com skeletons.
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