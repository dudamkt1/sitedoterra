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

type Platform = "ios" | "android" | "outro";

/**
 * Convite de instalação no MOBILE:
 * - aparece em TODO novo acesso ao site (enquanto o app não estiver instalado);
 * - quem não quiser pode fechar e seguir navegando sem ser incomodado
 *   durante aquela visita (o flag vive em sessionStorage, não em localStorage);
 * - no acesso seguinte o convite volta a aparecer.
 */
const DISMISS_KEY = (slug: string) => `pwa-convite-fechado-${slug}`;
const SHOW_DELAY_MS = 2500;

function detectPlatform(): Platform {
  const ua = window.navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && "ontouchend" in document);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Mobile|IEMobile|Opera Mini/i.test(ua)) return "android";
  return "outro";
}

function isMobileDevice(): boolean {
  const ua = window.navigator.userAgent;
  return (
    /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua) ||
    // iPadOS 13+ se identifica como Mac com suporte a toque
    (ua.includes("Macintosh") && "ontouchend" in document)
  );
}

export function PwaRegister(props: PwaRegisterProps) {
  const { enabled, slug, swUrl, scope, appName } = props;

  const [visible, setVisible] = useState(false);
  const [manualSteps, setManualSteps] = useState(false);
  const [platform, setPlatform] = useState<Platform>("outro");
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

    // 3) Convite persuasivo apenas no celular.
    if (!isMobileDevice()) return;

    // 4) Fechou nesta visita? Só reaparece no PRÓXIMO acesso.
    try {
      if (sessionStorage.getItem(DISMISS_KEY(slug))) return;
    } catch {}

    setPlatform(detectPlatform());

    // 5) Evento nativo (Android/Chrome) guarda o prompt para o botão instalar.
    function onPrompt(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
    }
    function onInstalled() {
      deferredPrompt.current = null;
      setVisible(false);
      setManualSteps(false);
      try {
        sessionStorage.setItem(DISMISS_KEY(slug), "1");
      } catch {}
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // 6) Mostra em todo acesso mobile — mesmo antes do evento nativo chegar.
    const t = setTimeout(() => {
      setVisible(true);
      // iOS nunca dispara beforeinstallprompt → passos manuais diretos.
      if (detectPlatform() === "ios") setManualSteps(true);
    }, SHOW_DELAY_MS);

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [enabled, slug, swUrl, scope, isStandalone]);

  async function installNow() {
    const p = deferredPrompt.current;
    if (!p) {
      // Prompt nativo indisponível: ensina o caminho manual em vez de deixar
      // o botão sem ação.
      setManualSteps(true);
      return;
    }
    await p.prompt();
    try {
      const choice = await p.userChoice;
      if (choice.outcome === "accepted") dismiss();
    } catch {}
    deferredPrompt.current = null;
  }

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY(slug), "1");
    } catch {}
    setVisible(false);
    setManualSteps(false);
  }

  if (!enabled) return null;

  return (
    <>
      {visible && (
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
                  Leve <strong>{appName}</strong> para a tela inicial do seu
                  celular e volte aqui com 1 toque — mais rápido, sem digitar
                  endereço. Leva menos de 10 segundos.
                </p>

                {!manualSteps && (
                  <p className="mt-2 text-[0.7rem] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                    <span>⚡ Abertura instantânea</span>
                    <span>📌 Ícone na tela inicial</span>
                  </p>
                )}

                {manualSteps && (
                  <ol className="mt-3 text-xs text-gray-700 space-y-1.5 list-decimal list-inside">
                    {platform === "ios" ? (
                      <>
                        <li>
                          Toque em <strong>Compartilhar</strong> (ícone ▲ na
                          barra do Safari).
                        </li>
                        <li>
                          Escolha <strong>Adicionar à Tela de Início</strong>.
                        </li>
                        <li>
                          Confirme tocando em <strong>Adicionar</strong>.
                        </li>
                      </>
                    ) : (
                      <>
                        <li>
                          Abra o menu do navegador (<strong>⋮</strong> ou{" "}
                          <strong>⋯</strong>).
                        </li>
                        <li>
                          Toque em <strong>Instalar app</strong> ou{" "}
                          <strong>Adicionar à tela inicial</strong>.
                        </li>
                        <li>
                          Confirme tocando em <strong>Instalar</strong>.
                        </li>
                      </>
                    )}
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
              <button
                type="button"
                onClick={installNow}
                className="flex-1 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:opacity-90 transition-opacity"
                style={{ background: props.themeColor }}
              >
                ⚡ Instalar agora
              </button>
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
