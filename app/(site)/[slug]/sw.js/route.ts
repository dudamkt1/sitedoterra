import { resolvePwaForRequest } from "@/lib/pwa/resolver";
import { buildServiceWorkerSource } from "@/lib/pwa/sw-source";

export const dynamic = "force-dynamic";

/**
 * GET /{slug}/sw.js
 * Service Worker com escopo /{slug}/ — isola o cache por usuário.
 */
export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const resolved = await resolvePwaForRequest({ slugParam: params.slug });
  if (!resolved || !resolved.settings.enabled) {
    return new Response("Not Found", { status: 404 });
  }

  const url = new URL(req.url);
  const uid = url.searchParams.get("u") || params.slug;

  const js = buildServiceWorkerSource({
    cacheName: uid,
    scope: resolved.basePath,
  });

  return new Response(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": resolved.basePath,
    },
  });
}
