import { resolvePwaForRequest } from "@/lib/pwa/resolver";

export const dynamic = "force-dynamic";

/**
 * GET /pwa/icon.svg  (raiz — domínio próprio ou HOME do domínio principal)
 * Mesmo ícone dinâmico, resolvido pelo hostname/tenant da HOME.
 */
export async function GET() {
  const resolved = await resolvePwaForRequest({ home: true });
  if (!resolved || !resolved.settings.enabled) {
    return new Response("Not Found", { status: 404 });
  }
  // Reaproveita o gerador do slug correspondente.
  const { GET } = await import("@/app/(site)/[slug]/pwa/icon.svg/route");
  return GET({} as Request, { params: { slug: resolved.ref.slug! } });
}
