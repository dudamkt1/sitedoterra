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
 * Como instalar neste aparelho:
 * - "native": Chrome/Android com prompt nativo → instala em 1 toque;
 * - "installed": app já instalado (detectado) → abre direto / orienta reinstalar;
 * - "system-browser": WebView de outro app (Instagram/WhatsApp) → abre no Chrome;
 * - "ios": iPhone (a Apple não permite instalar por botão) → guia de 3 toques;
 * - "manual": navegador sem instalação automática → passo a passo;
 * - "pending": ainda avaliando (vira native/manual em segundos).
 */
type InstallMode = "pending" | "native" | "installed" | "system-browser" | "ios" | "manual";

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
  const [installMode, setInstallMode] = useState<InstallMode>("pending");
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

    // 0) Garante <link rel="manifest"> CORRETO no <head>.
    //    Se o servidor emitiu um href quebrado (ex.: "[object Object]" —
    //    bug do metadata.manifest como objeto no Next 14), o link EXISTE e o
    //    antigo `querySelector` o aceitava → o navegador buscava 404 e o
    //    beforeinstallprompt nunca disparava. Agora: href inválido é REMOVIDO
    //    e substituído pela URL real do manifest deste usuário.
    try {
      if (manifestUrl) {
        let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        const expected = new URL(manifestUrl, window.location.origin).href;
        if (link) {
          const href = link.getAttribute("href") || "";
          const formOk =
            href.startsWith("/") ||
            href.startsWith("https://") ||
            href.startsWith("http://") ||
            href.startsWith("//");
          // Remove se o href é inválido (ex.: "[object Object]") ou se aponta
          // para OUTRO manifest (cache/SSR antigo de outra página).
          if (!formOk || link.href !== expected) {
            link.remove();
            link = null;
          }
        }
        if (!link) {
          link = document.createElement("link");
          link.rel = "manifest";
          link.href = manifestUrl;
          document.head.appendChild(link);
        }
        // REGRA: o manifest NUNCA pode ter crossorigin="use-credentials".
        // O Next 14 emite esse atributo quando se usa metadata.manifest, e a
        // combinação dele + Access-Control-Allow-Origin: * (sem
        // Allow-Credentials) reprova o CORS do fetcher do Google (WebAPK) —
        // ele não lê o manifest e instala o app sem o logotipo do usuário.
        // Remove defensivamente caso o HTML venha de um cache antigo.
        if (link) link.removeAttribute("crossorigin");
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
    const deviceInApp = isInAppBrowser();
    const deviceIos = detectPlatform() === "ios";
    const deviceAndroid = /Android/i.test(window.navigator.userAgent || "");

    // Detecta o modo de instalação deste aparelho (uma vez por visita).
    let modeCancelled = false;
    async function detectInstallMode() {
      // WebView de outro app no Android → sair para o Chrome (1 toque).
      if (deviceInApp && deviceAndroid && !deviceIos) {
        if (!modeCancelled) setInstallMode("system-browser");
        return;
      }
      // iPhone: a Apple não permite instalar por botão — só o guia manual.
      if (deviceIos) {
        if (!modeCancelled) setInstallMode("ios");
        return;
      }
      // App já instalado? Abre direto em vez de fingir instalar de novo
      // (o Chrome não dispara o prompt para app instalado — era isso que
      // caía no passo a passo sem instalar nada).
      try {
        const nav = window.navigator as Navigator & {
          getInstalledRelatedApps?: () => Promise<{ id?: string; url?: string }[]>;
        };
        if (typeof nav.getInstalledRelatedApps === "function") {
          const related = await nav.getInstalledRelatedApps().catch(() => []);
          if (!modeCancelled && related && related.length > 0) {
            setInstallMode("installed");
            return;
          }
        }
      } catch {}
      if (!modeCancelled) {
        if (deferredPrompt.current) {
          setInstallMode("native");
        } else {
          // Aguarda o prompt nativo; sem ele, cai no passo a passo.
          window.setTimeout(() => {
            if (!modeCancelled) {
              setInstallMode(deferredPrompt.current ? "native" : "manual");
            }
          }, 6000);
        }
      }
    }
    void detectInstallMode();

    // 5) Evento nativo (Android/Chrome) guarda o prompt para o botão instalar.
    //    Quando ele chega, o botão vira instalação em 1 toque de verdade.
    //    O PwaPromptCapture (beforeInteractive) pode já ter guardado o evento
    //    em window.__pwaBIP antes da hidratação — consome aqui para nunca
    //    perder a instalação automática.
    function promoteNative() {
      setInstallMode((m) => (m === "pending" || m === "manual" ? "native" : m));
    }
    function takeStashedPrompt(): boolean {
      try {
        const stashed = window.__pwaBIP;
        if (stashed) {
          deferredPrompt.current = stashed as BeforeInstallPromptEvent;
          setCanNativeInstall(true);
          promoteNative();
          return true;
        }
      } catch {}
      return false;
    }
    function onPrompt(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
      promoteNative();
    }
    function onStashedReady() {
      takeStashedPrompt();
    }
    function onInstalled() {
      deferredPrompt.current = null;
      setCanNativeInstall(false);
      setInstallMode("installed");
      celebrateInstalled();
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
      // iOS no Safari: nunca há prompt nativo → passos manuais diretos.
      // (Em WebView, o guia certo aparece ao tocar no botão.)
      if (deviceIos && !deviceInApp) setManualSteps(true);
    }, SHOW_DELAY_MS);

    return () => {
      modeCancelled = true;
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

  function appStartUrl(): string {
    try {
      return new URL(scope, window.location.origin).href;
    } catch {
      return window.location.href;
    }
  }

  function openApp() {
    try {
      (window.navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15);
    } catch {}
    window.location.href = appStartUrl();
  }

  /** Sai da WebView (Instagram/WhatsApp) direto para o Chrome — 1 toque. */
  function openInSystemBrowser() {
    try {
      (window.navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15);
    } catch {}
    try {
      const pageUrl = window.location.href;
      const u = new URL(pageUrl);
      window.location.href =
        `intent://${u.host}${u.pathname}${u.search}` +
        `#Intent;scheme=https;package=com.android.chrome;` +
        `S.browser_fallback_url=${encodeURIComponent(pageUrl)};end`;
    } catch {
      void copyAppLink();
    }
  }

  async function installNow() {
    try {
      (window.navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(15);
    } catch {}
    // App já instalado → abre direto (o Chrome não oferece instalar de novo).
    if (installMode === "installed") {
      openApp();
      return;
    }
    // WebView de outro app → abre no Chrome (só lá instala em 1 toque).
    if (installMode === "system-browser") {
      openInSystemBrowser();
      return;
    }
    // O evento nativo pode ter chegado depois da montagem: tenta o guardado
    // de novo na hora do toque antes de desistir para o passo a passo.
    try {
      const stashed = window.__pwaBIP;
      if (stashed && !deferredPrompt.current) {
        deferredPrompt.current = stashed as BeforeInstallPromptEvent;
        setCanNativeInstall(true);
      }
    } catch {}
    let p = deferredPrompt.current;
    // Sem prompt nativo AINDA: aguarda até 7s com feedback visual — o Chrome
    // costuma entregar o evento logo após SW + manifest prontos. Só abre o
    // passo a passo se o navegador realmente não oferecer instalação.
    if (!p && !preparing) {
      setPreparing(true);
      try {
        const arrived = await waitForNativePrompt(7000);
        if (arrived) {
          deferredPrompt.current = arrived;
          setCanNativeInstall(true);
          p = arrived;
        }
      } finally {
        setPreparing(false);
      }
    }
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
        celebrateInstalled();
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
  // Toque no INSTALAR sem prompt nativo ainda: mostra "Preparando..." e dá
  // uma última chance ao Chrome (o evento pode chegar DEPOIS do toque).
  const [preparing, setPreparing] = useState(false);
  // Confirmação visual após instalar (accepted/appinstalled): mostra
  // "APP INSTALADO" antes de esconder o convite.
  const [justInstalled, setJustInstalled] = useState(false);

  /** Exibe "APP INSTALADO" e esconde o convite em seguida. */
  function celebrateInstalled() {
    setJustInstalled(true);
    setManualSteps(false);
    setSheetOpen(false);
    window.setTimeout(() => {
      dismiss();
      window.setTimeout(() => setJustInstalled(false), 500);
    }, 4500);
  }

  /**
   * Aguarda o `beforeinstallprompt` por até `ms` milissegundos.
   * Resolve com o evento (pronto para `prompt()`) ou null.
   * O listener principal continua ativo e também recebe o evento — sem
   * duplicar estado, só garante que o TOQUE atual aproveite o nativo.
   */
  function waitForNativePrompt(ms: number): Promise<BeforeInstallPromptEvent | null> {
    return new Promise((resolve) => {
      try {
        if (window.__pwaBIP) return resolve(window.__pwaBIP as BeforeInstallPromptEvent);
      } catch {}
      if (deferredPrompt.current) return resolve(deferredPrompt.current);
      let done = false;
      const finish = (value: BeforeInstallPromptEvent | null) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", onPromptEvent);
        window.removeEventListener("pwa:bip-ready", onStashedEvent);
        resolve(value);
      };
      function onPromptEvent(e: Event) {
        try {
          e.preventDefault();
        } catch {}
        finish(e as BeforeInstallPromptEvent);
      }
      function onStashedEvent() {
        try {
          if (window.__pwaBIP) finish(window.__pwaBIP as BeforeInstallPromptEvent);
        } catch {}
      }
      const timer = window.setTimeout(() => finish(null), ms);
      window.addEventListener("beforeinstallprompt", onPromptEvent);
      window.addEventListener("pwa:bip-ready", onStashedEvent as EventListener);
    });
  }

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
                disabled={preparing || justInstalled}
                className="flex-1 rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-wide text-white hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-70"
                style={{ background: justInstalled ? "#16a34a" : props.themeColor }}
              >
                {justInstalled
                  ? "✓ App instalado"
                  : preparing
                  ? "⏳ Preparando…"
                  : installMode === "installed"
                    ? "📲 Abrir o app"
                    : installMode === "system-browser"
                      ? "🌐 Abrir no Chrome"
                      : "⚡ Instalar"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all"
              >
                Agora não
              </button>
            </div>
            {installMode === "installed" && (
              <p className="mt-2 text-[0.65rem] text-gray-500 text-center leading-relaxed">
                Já instalado neste aparelho — abrindo direto. Trocou logo ou nome? Remova o app e instale de novo.
              </p>
            )}
            {installMode === "system-browser" && (
              <p className="mt-2 text-[0.65rem] text-gray-500 text-center leading-relaxed">
                Você está no navegador do Instagram/WhatsApp — abra no Chrome para instalar em 1 toque.
              </p>
            )}
            {installMode === "manual" && (
              <p className="mt-2 text-[0.65rem] text-gray-500 text-center leading-relaxed">
                Seu navegador não instala automaticamente — toque em Instalar e siga o passo a passo, ou abra no Chrome.
              </p>
            )}
            {(installMode === "pending" || installMode === "native") && !canNativeInstall && !manualSteps && (
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
