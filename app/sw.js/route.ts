import { resolvePwaForRequest } from "@/lib/pwa/resolver";
import { buildServiceWorkerSource } from "@/lib/pwa/sw-source";

export const dynamic = "force-dynamic";

/**
 * GET /sw.js  (raiz — domínio próprio ou HOME do domínio principal)
 * Escopo "/", cache isolado pelo parâmetro ?u={slug}.
 */
export async function GET(req: Request) {
  const resolved = await resolvePwaForRequest({ home: true });
  if (!resolved || !resolved.settings.enabled) {
    return new Response("Not Found", { status: 404 });
  }

  const url = new URL(req.url);
  const uid = url.searchParams.get("u") || resolved.ref.slug!;

  const js = buildServiceWorkerSource({
    cacheName: uid,
    scope: "/",
  });

  return new Response(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
