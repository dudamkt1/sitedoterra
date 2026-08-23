import { resolvePwaForRequest } from "@/lib/pwa/resolver";

export const dynamic = "force-dynamic";

/**
 * GET /pwa/icon.svg  (raiz — domínio próprio)
 * Mesmo ícone dinâmico, resolvido pelo hostname do domínio próprio.
 */
export async function GET() {
  const resolved = await resolvePwaForRequest();
  if (!resolved || !resolved.settings.enabled || !resolved.ref.isCustomDomain) {
    return new Response("Not Found", { status: 404 });
  }
  // Reaproveita o gerador do slug correspondente.
  const { GET } = await import("@/app/(site)/[slug]/pwa/icon.svg/route");
  return GET({} as Request, { params: { slug: resolved.ref.slug! } });
}
