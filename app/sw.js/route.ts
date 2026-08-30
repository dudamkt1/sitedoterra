import { resolvePwaForRequest } from "@/lib/pwa/resolver";
import { buildServiceWorkerSource } from "@/lib/pwa/sw-source";
import { pwaVersionToken } from "@/lib/pwa/config";

export const dynamic = "force-dynamic";

/**
 * GET /sw.js  (raiz — domínio próprio ou HOME do domínio principal)
 * Escopo "/", cache isolado pelo slug + versionado pelo `updated_at` das
 * configurações PWA. Trocar o ícone no painel invalida o cache antigo
 * automaticamente — sem isso, o app instalado no celular ficaria preso no
 * ícone antigo indefinidamente.
 */
export async function GET(req: Request) {
  const resolved = await resolvePwaForRequest({ home: true });
  if (!resolved || !resolved.settings.enabled) {
    return new Response("Not Found", { status: 404 });
  }

  const uid = resolved.ref.slug!;
  // Versão do cache = timestamp da última atualização das configurações PWA.
  // Sempre que o usuário salva no painel, este token muda → SW é reinstalado
  // e o cache anterior é invalidado.
  const cacheVersion = pwaVersionToken(resolved.settings);

  const js = buildServiceWorkerSource({
    cacheName: uid,
    scope: "/",
    cacheVersion,
  });

  return new Response(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
