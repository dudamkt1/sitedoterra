/**
 * Fonte do Service Worker da PWA do usuário.
 *
 * - Escopo isolado por usuário: só intercepta requests dentro de `scope`.
 *   → plataforma: /{slug}/  ·  domínio próprio: /
 * - Nome de cache inclui o identificador do usuário (`uid`) + `cacheVersion` —
 *   sempre que o usuário troca o ícone, a versão muda e o SW anterior é
 *   invalidado automaticamente, forçando o navegador a buscar manifest/ícones
 *   novos. Sem isso, o PWA instalado fica preso no ícone antigo indefinidamente.
 * - NUNCA cacheia /api/*, /auth/* nem métodos não-GET.
 * - Com escopo "/" (HOME/domínio próprio), áreas privadas da plataforma
 *   (/painel, /admin, /login, /cadastro) também ficam de fora do app.
 */
export function buildServiceWorkerSource(opts: {
  cacheName: string;
  scope: string;
  cacheVersion?: string;
}): string {
  const cacheName = opts.cacheName.replace(/[^\w.-]/g, "");
  const scope = opts.scope.endsWith("/") ? opts.scope : `${opts.scope}/`;
  // Sem version = "v1" (compatibilidade). Com version = v<token-base36> (dinâmico).
  const ver = (opts.cacheVersion || "1").replace(/[^\w]/g, "");
  const versionedCache = `pwa-${cacheName}-v${ver}`;

  return `/* PWA service worker — gerado automaticamente */
const CACHE = ${JSON.stringify(versionedCache)};
const SCOPE = ${JSON.stringify(scope)};
const STATIC_HINTS = ["/_next/static/", "/_next/image/", "/pwa/"];
// Áreas privadas da plataforma: nunca interceptadas nem cacheadas pelo app.
const EXCLUDED_PREFIXES = ["/api", "/auth", "/painel", "/admin", "/login", "/cadastro"];

self.addEventListener("install", (event) => {
  // Sempre tomar controle imediatamente — o cache novo entra sem esperar
  // o usuário fechar todas as abas (comum em PWAs instaladas no celular).
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Limpa caches de versões anteriores do MESMO usuário (prefixo pwa-<slug>-v*).
  // Garante que, ao salvar nova config, o ícone antigo do app instalado é
  // descartado automaticamente — sem isso, o SW antigo continuaria servindo
  // os ícones em cache e o novo ícone nunca apareceria.
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const prefix = "pwa-" + ${JSON.stringify(cacheName)} + "-v";
      await Promise.all(
        keys
          .filter((k) => k.startsWith(prefix) && k !== CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isExcluded(pathname) {
  return EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isStatic(url) {
  if (STATIC_HINTS.some((h) => url.pathname.includes(h))) return true;
  return /\\.(css|js|mjs|woff2?|ttf|otf|png|jpe?g|gif|webp|svg|ico|avif)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== location.origin) return;
  if (isExcluded(url.pathname)) return;

  // Isolamento por escopo: fora do app do usuário, não interfere.
  const inScope = url.pathname === SCOPE || url.pathname.startsWith(SCOPE);
  if (!inScope && SCOPE !== "/") return;

  // Manifest + ícones do PWA: network-first com fallback ao cache.
  // Garante que, ao trocar o ícone, o usuário SEMPRE vê a versão nova na
  // próxima visita — sem isso, o cache-first mostraria o ícone antigo.
  // Inclui todas as variantes (180/192/512/maskable) + o SVG de fallback.
  const isPwaAsset = url.pathname.endsWith("/manifest.webmanifest") ||
                      /\\/(pwa\\/icon\\.svg|icon-180|icon-192|icon-512|icon-maskable)/.test(url.pathname) ||
                      /\\/pwa\\/icon/.test(url.pathname) ||
                      url.searchParams.has("v"); // qualquer asset com ?v=<token> é versionado
  if (isPwaAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          const cached = await cache.match(req);
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Navegação: rede primeiro, cache como fallback offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            const cache = await caches.open(CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          const cached = (await caches.match(req)) || (await caches.match(SCOPE));
          return (
            cached ||
            new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          );
        }
      })()
    );
    return;
  }

  // Estáticos: stale-while-revalidate.
  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => undefined);
        return cached || (await network) || Response.error();
      })()
    );
  }
});
`;
}
