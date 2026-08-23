"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PwaRegisterProps {
  enabled: boolean;
  slug: string;
  /** URL do manifest (mesma origem do acesso) */
  manifestUrl: string;
  /** URL do service worker */
  swUrl: string;
  /** escopo do app: "/{slug}/" ou "/" */
  scope: string;
  appName: string;
  themeColor: string;
}

const DISMISS_KEY = (slug: string) => `pwa-dismiss-${slug}`;
const DISMISS_DAYS = 7;

export function PwaRegister(props: PwaRegisterProps) {
  const { enabled, slug, swUrl, scope, appName } = props;

  const [invite, setInvite] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  const isStandalone = useCallback(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // 1) Service worker (escopo do usuário)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(swUrl, { scope }).catch(() => {});
    }

    // 2) Já instalado? Não insistir.
    if (isStandalone()) return;

    // 3) Usuário dispensou recentemente?
    try {
      const raw = localStorage.getItem(DISMISS_KEY(slug));
      if (raw && Date.now() - Number(raw) < DISMISS_DAYS * 86400000) return;
    } catch {}

    // 4) iOS não dispara beforeinstallprompt → instruções manuais.
    const ua = window.navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes("Macintosh") && "ontouchend" in document);
    if (isIOS) {
      const t = setTimeout(() => setIosHelp(true), 2500);
      return () => clearTimeout(t);
    }

    // 5) Android/Chrome: espera o evento nativo.
    function onPrompt(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setInvite(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [enabled, slug, swUrl, scope, isStandalone]);

  async function installNow() {
    const p = deferredPrompt.current;
    if (!p) return;
    await p.prompt();
    try {
      await p.userChoice;
    } catch {}
    deferredPrompt.current = null;
    setInvite(false);
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY(slug), String(Date.now()));
    } catch {}
    setInvite(false);
    setIosHelp(false);
  }

  if (!enabled) return null;

  return (
    <>
      {(invite || iosHelp) && (
        <div
          role="dialog"
          aria-label="Instalar aplicativo"
          className="fixed inset-x-3 bottom-16 z-[80] mx-auto max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
        >
          <div className="h-1.5" style={{ background: props.themeColor }} />
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📲</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  Instalar aplicativo
                </p>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Tenha este aplicativo na tela inicial do seu celular para
                  acessar rapidamente.
                </p>

                {iosHelp && (
                  <ol className="mt-3 text-xs text-gray-700 space-y-1.5 list-decimal list-inside">
                    <li>
                      Toque em <strong>Compartilhar</strong> (ícone ▲ na barra
                      do Safari).
                    </li>
                    <li>
                      Escolha <strong>Adicionar à Tela de Início</strong>.
                    </li>
                    <li>
                      Confirme tocando em <strong>Adicionar</strong>.
                    </li>
                  </ol>
                )}
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Fechar"
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              {!iosHelp && (
                <button
                  type="button"
                  onClick={installNow}
                  className="flex-1 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:opacity-90 transition-opacity"
                  style={{ background: props.themeColor }}
                >
                  ⚡ Instalar agora
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-4 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Agora não
              </button>
            </div>

            <p className="mt-2 text-[0.65rem] text-gray-400 text-center truncate">
              {appName}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
