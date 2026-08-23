import { NextResponse } from "next/server";
import { resolvePwaForRequest } from "@/lib/pwa/resolver";
import { buildManifest } from "@/lib/pwa/config";

export const dynamic = "force-dynamic";

/**
 * GET /{slug}/manifest.webmanifest
 * Manifest DINÂMICO do usuário (nome, ícones, cores, start_url e scope).
 * Em domínio próprio o mesmo conteúdo é servido em /manifest.webmanifest.
 */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const resolved = await resolvePwaForRequest({ slugParam: params.slug });
  if (!resolved || !resolved.settings.enabled) {
    return new Response("Not Found", { status: 404 });
  }

  const manifest = buildManifest(resolved.settings, {
    origin: resolved.ref.origin,
    basePath: resolved.basePath,
  });

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300",
      "Service-Worker-Allowed": resolved.basePath,
    },
  });
}
