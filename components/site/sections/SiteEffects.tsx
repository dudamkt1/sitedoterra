"use client";

import { useEffect } from "react";

/**
 * Observa os elementos `.reveal` dentro de #tenant-site e adiciona `.visible`
 * quando entram na viewport (animação de entrada das seções).
 * Inclui nós adicionados depois do mount (ex.: seções client-side que
 * terminam o fetch após hidratar) via MutationObserver.
 */
export function SiteEffects() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.add("visible")),
      { threshold: 0.12 }
    );
    const watch = (root: ParentNode) =>
      root.querySelectorAll("#tenant-site .reveal").forEach((r) => observer.observe(r));
    watch(document);
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n instanceof Element) {
            if (n.matches("#tenant-site .reveal")) observer.observe(n);
            n.querySelectorAll("#tenant-site .reveal").forEach((r) => observer.observe(r));
          }
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      observer.disconnect();
    };
  }, []);

  return null;
}
