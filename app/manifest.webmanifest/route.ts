import { NextResponse } from "next/server";
import { resolvePwaForRequest } from "@/lib/pwa/resolver";
import { buildManifest } from "@/lib/pwa/config";

export const dynamic = "force-dynamic";

/**
 * GET /manifest.webmanifest  (raiz)
 * Usado quando a PWA é acessada por DOMÍNIO PRÓPRIO:
 * o middleware reescreve "/" → /{slug}, mas este arquivo é pedido na raiz.
 * Resolve o usuário pelo hostname (RPC get_public_tenant_by_domain).
 */
export async function GET() {
  const resolved = await resolvePwaForRequest();
  if (!resolved || !resolved.settings.enabled || !resolved.ref.isCustomDomain) {
    return new Response("Not Found", { status: 404 });
  }

  const manifest = buildManifest(resolved.settings, {
    origin: resolved.ref.origin,
    basePath: "/",
  });

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300",
      "Service-Worker-Allowed": "/",
    },
  });
}
