/**
 * Fonte do Service Worker da PWA do usuário.
 *
 * - Escopo isolado por usuário: só intercepta requests dentro de `scope`.
 *   → plataforma: /{slug}/  ·  domínio próprio: /
 * - Nome de cache inclui o identificador do usuário (`uid`) — nunca mistura
 *   dados entre usuários, mesmo que um SW compartilhado sirva a raiz.
 * - NUNCA cacheia /api/*, /auth/* nem métodos não-GET.
 */
export function buildServiceWorkerSource(opts: {
  cacheName: string;
  scope: string;
}): string {
  const cacheName = opts.cacheName.replace(/[^\w.-]/g, "");
  const scope = opts.scope.endsWith("/") ? opts.scope : `${opts.scope}/`;

  return `/* PWA service worker — gerado automaticamente */
const CACHE = ${JSON.stringify(`pwa-${cacheName}-v1`)};
const SCOPE = ${JSON.stringify(scope)};
const STATIC_HINTS = ["/_next/static/", "/_next/image/", "/pwa/"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("pwa-") && k !== CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

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
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Isolamento por escopo: fora do app do usuário, não interfere.
  const inScope = url.pathname === SCOPE || url.pathname.startsWith(SCOPE);
  if (!inScope && SCOPE !== "/") return;

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
