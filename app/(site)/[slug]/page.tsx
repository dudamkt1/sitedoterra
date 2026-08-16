import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { SiteHome } from "@/components/site/SiteHome";
import { LoggedInNotice } from "@/components/site/LoggedInNotice";
import { SuspendedSitePage } from "@/components/site/SuspendedSitePage";
import { resolveTenantAccess } from "@/lib/tenant";
import { resolveHomeSections } from "@/lib/home";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { tenant } = await resolveTenantAccess({ slug: params.slug });
  if (!tenant) return { title: "Site não encontrado" };
  const name = tenant.profile_name || tenant.site_name || tenant.slug;
  const siteData = (tenant.site_data || {}) as Record<string, unknown>;
  const faviconUrl = (siteData.faviconUrl as string) || undefined;
  return {
    title: `${name} | Consultora doTERRA`,
    description: `Site oficial de ${name} — consultora doTERRA. Óleos essenciais puros, dicas de bem-estar e agendamento de consultas.`,
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
  };
}

export default async function TenantSitePage({ params }: { params: { slug: string } }) {
  const { tenant, access } = await resolveTenantAccess({ slug: params.slug });

  if (!tenant) {
    notFound();
  }

  const user = await getCurrentUser();

  const headerList = headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const protocol = headerList.get("x-forwarded-proto") || "https";
  const canonicalUrl =
    host.endsWith(".vercel.app") || !host
      ? `${process.env.NEXT_PUBLIC_APP_URL || `https://${host}`}/${tenant.slug}`
      : `https://${host}`;

  if (access === "available") {
    // tenantDataOverridesGlobal=true: os dados do próprio tenant (site_settings,
    // editados em /painel/meu-site) têm prioridade sobre o template global.
    const sections = await resolveHomeSections({ tenant, tenantDataOverridesGlobal: true });
    const siteData = (tenant.site_data || {}) as Record<string, unknown>;
    return (
      <>
        <link rel="canonical" href={canonicalUrl} />
        {user && <LoggedInNotice email={user.email} />}
        <SiteHome
          slug={tenant.slug}
          sections={sections}
contact={{
              whatsapp: (siteData.whatsapp as string) || undefined,
              email: (siteData.email as string) || tenant.email || undefined,
              instagram: siteData.instagram ? `https://instagram.com/${String(siteData.instagram).replace(/^@/, "")}` : undefined,
              profileName: tenant.profile_name || undefined,
            }}
            logo={{
              mode: (siteData.logoMode as "image" | "text") || undefined,
              url: (siteData.logoUrl as string) || undefined,
              lightUrl: (siteData.logoLightUrl as string) || undefined,
              text: (siteData.logoText as string) || undefined,
            }}
        />
      </>
    );
  }

  return (
    <>
      <link rel="canonical" href={canonicalUrl} />
      {user && <LoggedInNotice email={user.email} />}
      <SuspendedSitePage tenant={tenant} host={host} />
    </>
  );
}
