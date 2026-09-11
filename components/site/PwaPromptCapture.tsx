"use client";

import Script from "next/script";

/**
 * Captura o `beforeinstallprompt` CEDO (beforeInteractive, no <head>).
 *
 * O evento pode disparar antes da hidratação do React — se o PwaRegister
 * montasse depois, o prompt se perdia e o botão "Instalar" caía no passo a
 * passo. Aqui o evento é guardado em `window.__pwaBIP` + aviso via
 * `pwa:bip-ready`, e o PwaRegister consome ao montar.
 */
const CAPTURE_JS = `(function(){try{window.__pwaBIP=null;window.addEventListener("beforeinstallprompt",function(e){try{e.preventDefault()}catch(_){}window.__pwaBIP=e;try{window.dispatchEvent(new CustomEvent("pwa:bip-ready"))}catch(_){}});}catch(_){}})();`;

declare global {
  interface Window {
    __pwaBIP?: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }) | null;
  }
}

export function PwaPromptCapture() {
  return (
    <Script
      id="pwa-prompt-capture"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: CAPTURE_JS }}
    />
  );
}
