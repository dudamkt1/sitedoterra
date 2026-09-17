import { headers } from "next/headers";
import { getPublicTenantBySlug, getPublicTenantByDomain } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET /favicon.ico — proxy do favicon PNG configurado no painel (site_data.faviconUrl)
 * do tenant correspondente à página que fez a requisição.
 *
 * Resolve o tenant na ordem:
 *  1. Domínio personalizado (ex.: www.seusite.com.br) — via host da requisição
 *  2. Referer contendo /{slug} na plataforma principal — extrai o slug
 *  3. HOME_TENANT_SLUG (fallback para a home do domínio principal)
 *
 * Se não houver favicon configurado para o tenant resolvido, retorna 404
 * para o browser usar seu fallback padrão.
 */
export async function GET() {
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "";
    const referer = h.get("referer") || "";

    let tenant = null;
    let faviconUrl: string | undefined;

    // 1. Domínio personalizado verificado
    if (host) {
      const domain = host.toLowerCase().replace(/^www\./, "").split(":")[0];
      const isPlatformDomain = domain.endsWith(".vercel.app") ||
        (process.env.NEXT_PUBLIC_HOME_URL && domain === new URL(process.env.NEXT_PUBLIC_HOME_URL).host.replace(/^www\./, "")) ||
        (process.env.NEXT_PUBLIC_APP_URL && domain === new URL(process.env.NEXT_PUBLIC_APP_URL).host.replace(/^www\./, ""));


      if (!isPlatformDomain) {
        tenant = await getPublicTenantByDomain(domain);
      }
    }

    // 2. Referer na plataforma principal (oleos.topconsultores.com.br/{slug})
    if (!tenant && referer) {
      try {
        const refUrl = new URL(referer);
        const refHost = refUrl.host.toLowerCase().replace(/^www\./, "");
        const homeHost = (process.env.NEXT_PUBLIC_HOME_URL || process.env.NEXT_PUBLIC_APP_URL || "")
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0];

        if (refHost === homeHost || refHost.endsWith(".vercel.app")) {
          const pathSegments = refUrl.pathname.split("/").filter(Boolean);
          if (pathSegments.length > 0) {
            const slug = pathSegments[0];
            if (slug !== "demonstracao" && slug !== "painel" && slug !== "admin" && slug !== "login" && slug !== "cadastro" && slug !== "checkout" && slug !== "afiliados") {
              tenant = await getPublicTenantBySlug(slug);
            }
          }
        }
      } catch {
        // Referer inválido, ignora
      }
    }

    // 3. Fallback: tenant oficial da HOME
    if (!tenant) {
      const slug = process.env.HOME_TENANT_SLUG || "usuarioteste";
      tenant = await getPublicTenantBySlug(slug);
    }

    const siteData = (tenant?.site_data as Record<string, unknown> | null) || {};
    faviconUrl = siteData.faviconUrl as string | undefined;

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
