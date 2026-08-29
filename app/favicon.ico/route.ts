import { getPublicTenantBySlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET /favicon.ico — proxy do favicon PNG configurado no painel (site_data.faviconUrl)
 * do tenant da HOME. Garante que a aba do navegador mostre o PNG mesmo quando
 * o browser ignora <link rel="icon"> e pede /favicon.ico direto.
 * Se não houver favicon configurado, retorna 404 para o browser usar fallback.
 */
export async function GET() {
  try {
    const slug = process.env.HOME_TENANT_SLUG || "usuarioteste";
    const tenant = await getPublicTenantBySlug(slug);
    const siteData = (tenant?.site_data as Record<string, unknown> | null) || {};
    const faviconUrl = siteData.faviconUrl as string | undefined;
    if (!faviconUrl) return new Response(null, { status: 404 });

    // Busca o PNG no R2/Storage e repassa com cache agressivo
    const res = await fetch(faviconUrl, { next: { revalidate: 3600 } });
    if (!res.ok) return new Response(null, { status: 404 });
    const buf = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "image/png";
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": ct.includes("png") ? "image/png" : ct,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
