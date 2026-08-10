"use client";

import { useEffect } from "react";

/**
 * Observa os elementos `.reveal` dentro de #tenant-site e adiciona `.visible`
 * quando entram na viewport (animação de entrada das seções).
 */
export function SiteEffects() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.add("visible")),
      { threshold: 0.12 }
    );
    document.querySelectorAll("#tenant-site .reveal").forEach((r) => observer.observe(r));
    return () => observer.disconnect();
  }, []);

  return null;
}
