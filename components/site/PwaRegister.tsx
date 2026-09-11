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
  const { enabled, slug, manifestUrl, swUrl, scope, appName } = props;

  const [visible, setVisible] = useState(false);
  const [manualSteps, setManualSteps] = useState(false);
  const [platform, setPlatform] = useState<Platform>("outro");
  // true quando o navegador entregou o prompt nativo (Android/Chrome).
  // Sem isso (iOS sempre; Android sem evento), o botão guia o passo a passo.
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  // Pulso visual quando o passo a passo é revelado pelo toque.
  const [stepsPulse, setStepsPulse] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const stepsRef = useRef<HTMLOListElement | null>(null);

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

    // 0) Garante <link rel="manifest"> no <head> (rede de segurança: se o
    //    metadata do servidor não emitiu, o navegador ainda encontra o
    //    manifest e mostra o logotipo na instalação).
    try {
      if (!document.querySelector('link[rel="manifest"]') && manifestUrl) {
        const link = document.createElement("link");
        link.rel = "manifest";
        link.href = manifestUrl;
        document.head.appendChild(link);
      }
    } catch {}

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
    //    Quando ele chega, o botão vira instalação em 1 toque de verdade.
    function onPrompt(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
    }
    function onInstalled() {
      deferredPrompt.current = null;
      setCanNativeInstall(false);
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
  }, [enabled, slug, manifestUrl, swUrl, scope, isStandalone]);

  function revealSteps() {
    // Feedback tátil imediato: o toque SEMPRE responde.
    try {
      (window.navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15);
    } catch {}
    setManualSteps(true);
    // Pulso + rolagem até o passo a passo: impossível "nada acontecer".
    setStepsPulse(true);
    window.setTimeout(() => setStepsPulse(false), 1600);
    window.setTimeout(() => {
      try {
        stepsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch {}
    }, 60);
  }

  async function installNow() {
    try {
      (window.navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15);
    } catch {}
    const p = deferredPrompt.current;
    if (!p) {
      // Sem prompt nativo (iOS sempre; Android sem evento): guia visual.
      revealSteps();
      return;
    }
    try {
      await p.prompt();
      const choice = await p.userChoice;
      if (choice.outcome === "accepted") {
        dismiss();
        return;
      }
      // Recusou/dispensou o diálogo nativo: mostra o caminho manual.
      revealSteps();
    } catch {
      revealSteps();
    } finally {
      deferredPrompt.current = null;
      setCanNativeInstall(false);
    }
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
                  <ol
                    ref={stepsRef}
                    className={`mt-3 text-xs text-gray-700 space-y-1.5 list-decimal list-inside rounded-xl border p-3 transition-all ${
                      stepsPulse
                        ? "border-emerald-500 bg-emerald-50 shadow-[0_0_0_3px_rgba(29,92,58,0.15)]"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    {platform === "ios" ? (
                      <>
                        <li>
                          Toque em <strong>Compartilhar</strong>{" "}
                          <svg
                            viewBox="0 0 24 24"
                            className="inline h-3.5 w-3.5 -mt-0.5 text-gray-700"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M12 3v13" />
                            <path d="m7 8 5-5 5 5" />
                            <path d="M5 12v8h14v-8" />
                          </svg>{" "}
                          na barra do Safari.
                        </li>
                        <li>
                          Role e escolha <strong>Adicionar à Tela de Início</strong>.
                        </li>
                        <li>
                          Confirme tocando em <strong>Adicionar</strong> no topo.
                        </li>
                      </>
                    ) : (
                      <>
                        <li>
                          Abra o menu do navegador (<strong>⋮</strong> no Chrome).
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
                className="flex-1 rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-wide text-white hover:opacity-90 active:scale-[0.98] transition-all"
                style={{ background: props.themeColor }}
              >
                {canNativeInstall ? "⚡ Instalar agora" : "📲 Como instalar"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all"
              >
                Agora não
              </button>
            </div>
            {!canNativeInstall && !manualSteps && (
              <p className="mt-2 text-[0.65rem] text-gray-400 text-center">
                Toque acima e siga o passo a passo de 10 segundos
              </p>
            )}

            <p className="mt-2 text-[0.65rem] text-gray-400 text-center truncate">
              {appName}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
