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

function isInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  // WebViews de Instagram/Facebook/WhatsApp/TikTok: sem API de instalação.
  // É preciso abrir no Chrome/Safari primeiro.
  return /Instagram|FBAN|FBAV|FB_IAB|FB4A|Line\/|Twitter|WhatsApp|TikTok|Snapchat|Pinterest|KAKAOTALK|Naver|; wv/i.test(ua);
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
  // Navegador dentro de outro app (Instagram/WhatsApp): sem API de instalação.
  const [inAppBrowser, setInAppBrowser] = useState(false);
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
    setInAppBrowser(isInAppBrowser());

    // 5) Evento nativo (Android/Chrome) guarda o prompt para o botão instalar.
    //    Quando ele chega, o botão vira instalação em 1 toque de verdade.
    //    O PwaPromptCapture (beforeInteractive) pode já ter guardado o evento
    //    em window.__pwaBIP antes da hidratação — consome aqui para nunca
    //    perder a instalação automática.
    function takeStashedPrompt(): boolean {
      try {
        const stashed = window.__pwaBIP;
        if (stashed) {
          deferredPrompt.current = stashed as BeforeInstallPromptEvent;
          setCanNativeInstall(true);
          return true;
        }
      } catch {}
      return false;
    }
    function onPrompt(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
    }
    function onStashedReady() {
      takeStashedPrompt();
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
    window.addEventListener("pwa:bip-ready", onStashedReady as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    // Evento pode ter chegado antes da hidratação: consome o guardado.
    takeStashedPrompt();

    // 6) Mostra em todo acesso mobile — mesmo antes do evento nativo chegar.
    const t = setTimeout(() => {
      setVisible(true);
      // iOS nunca dispara beforeinstallprompt → passos manuais diretos.
      if (detectPlatform() === "ios") setManualSteps(true);
    }, SHOW_DELAY_MS);

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("pwa:bip-ready", onStashedReady as EventListener);
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
      // Sem prompt nativo (iPhone sempre; Android sem evento ou WebView):
      // abre a tela de instalação visual — o caminho mais curto possível.
      openSheet();
      return;
    }
    try {
      await p.prompt();
      const choice = await p.userChoice;
      if (choice.outcome === "accepted") {
        dismiss();
        return;
      }
      // Recusou/dispensou o diálogo nativo: abre a tela visual.
      openSheet();
    } catch {
      openSheet();
    } finally {
      deferredPrompt.current = null;
      setCanNativeInstall(false);
    }
  }

  const [sheetOpen, setSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function openSheet() {
    try {
      (window.navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15);
    } catch {}
    setSheetOpen(true);
  }

  async function copyAppLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível (http/WebView antiga): seleciona via prompt
      try {
        window.prompt("Copie o link do aplicativo:", window.location.href);
      } catch {}
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

                {manualSteps && inAppBrowser && (
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
                    <strong>⚠️ Você está abrindo pelo navegador de outro app</strong>
                    <br />
                    Toque em <strong>⋯</strong> e escolha{" "}
                    <strong>“Abrir no Chrome”</strong> (Android) ou{" "}
                    <strong>“Abrir no Safari”</strong> (iPhone) — só o navegador
                    principal instala o aplicativo.
                  </div>
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
                ⚡ Instalar
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
                Toque em Instalar e siga o passo a passo de 10 segundos
              </p>
            )}

            <p className="mt-2 text-[0.65rem] text-gray-400 text-center truncate">
              {appName}
            </p>
          </div>
        </div>
      )}

      {/* Tela de instalação: o caminho mais curto que cada sistema permite.
          Android/Chrome com prompt nativo instala em 1 toque (sem esta tela).
          iPhone e WebViews caem aqui: 3 toques grandes e visuais. */}
      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Instalar aplicativo"
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white shadow-2xl overflow-hidden sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5" style={{ background: props.themeColor }} />
            <div className="px-6 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
              <p className="text-center text-lg font-extrabold text-gray-900">
                Instalar {appName}
              </p>
              <p className="mt-1 text-center text-xs text-gray-500">
                {platform === "ios"
                  ? "No iPhone são 3 toques no Safari 👇"
                  : "Leve o app para sua tela inicial 👇"}
              </p>

              {inAppBrowser && (
                <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-[13px] text-amber-900 leading-relaxed">
                  <strong>⚠️ Abra no navegador principal primeiro:</strong> toque em{" "}
                  <strong>⋯</strong> e escolha <strong>“Abrir no Chrome”</strong>{" "}
                  (Android) ou <strong>“Abrir no Safari”</strong> (iPhone).
                </div>
              )}

              <div className="mt-4 space-y-2.5">
                {(platform === "ios"
                  ? [
                      { n: "1", t: "Toque em Compartilhar ⬆️ na barra do Safari" },
                      { n: "2", t: "Role e toque em “Adicionar à Tela de Início”" },
                      { n: "3", t: "Confirme em “Adicionar” — pronto! 🎉" },
                    ]
                  : [
                      { n: "1", t: "Toque no menu ⋮ do Chrome" },
                      { n: "2", t: "Toque em “Instalar app”" },
                      { n: "3", t: "Confirme em “Instalar” — pronto! 🎉" },
                    ]
                ).map((s) => (
                  <div key={s.n} className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white"
                      style={{ background: props.themeColor }}
                    >
                      {s.n}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{s.t}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={copyAppLink}
                  className="flex-1 rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-wide text-white active:scale-[0.98] transition-all"
                  style={{ background: props.themeColor }}
                >
                  {copied ? "✓ Link copiado!" : "🔗 Copiar link do app"}
                </button>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="rounded-xl px-5 py-3.5 text-xs font-semibold text-gray-600 bg-gray-100 active:scale-[0.98] transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
