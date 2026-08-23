import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { SiteHome } from "@/components/site/SiteHome";
import { LoggedInNotice } from "@/components/site/LoggedInNotice";
import { SuspendedSitePage } from "@/components/site/SuspendedSitePage";
import { DemoPublicSite } from "@/components/demo/DemoPublicSite";
import { PwaRegister } from "@/components/site/PwaRegister";
import { resolveTenantAccess } from "@/lib/tenant";
import { resolveHomeSections } from "@/lib/home";
import { getCurrentUser } from "@/lib/auth";
import { resolvePwaForRequest } from "@/lib/pwa/resolver";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function pwaUrls(basePath: string) {
  const manifestUrl =
    basePath === "/" ? "/manifest.webmanifest" : `${basePath}manifest.webmanifest`;
  const swUrl = basePath === "/" ? "/sw.js" : `${basePath}sw.js`;
  const iconUrl = `${basePath}pwa/icon.svg`;
  return { manifestUrl, swUrl, iconUrl };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  if (params.slug === "demonstracao") {
    const pwa = await resolvePwaForRequest({ slugParam: "demonstracao" });
    const meta: Metadata = {
      title: "Demonstração | SITE DOTERRA — TopConsultores",
      description:
        "Site de demonstração do SITE DOTERRA. Explore um site profissional de consultora doTERRA com IA, agendamento, produtos e mais.",
      robots: { index: false },
    };
    if (pwa?.settings.enabled) {
      const { manifestUrl, iconUrl } = pwaUrls(pwa.basePath);
      meta.manifest = manifestUrl;
      meta.icons = [{ url: iconUrl, type: "image/svg+xml" }];
      meta.appleWebApp = {
        capable: true,
        title: pwa.settings.short_name || pwa.settings.app_name,
        statusBarStyle: "default",
      };
      meta.other = { "apple-mobile-web-app-capable": "yes" };
    }
    return meta;
  }

  const { tenant } = await resolveTenantAccess({ slug: params.slug });
  if (!tenant) return { title: "Site não encontrado" };

  const name = tenant.profile_name || tenant.site_name || tenant.slug;
  const siteData = (tenant.site_data || {}) as Record<string, unknown>;
  const faviconUrl = (siteData.faviconUrl as string) || undefined;

  const meta: Metadata = {
    title: `${name} | Consultora doTERRA`,
    description: `Site oficial de ${name} — consultora doTERRA. Óleos essenciais puros, dicas de bem-estar e agendamento de consultas.`,
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
  };

  // PWA do usuário
  const pwa = await resolvePwaForRequest({ slugParam: params.slug });
  if (pwa?.settings.enabled) {
    const { manifestUrl, iconUrl } = pwaUrls(pwa.basePath);
    meta.manifest = manifestUrl;
    meta.icons = [...(meta.icons as never[] ?? []), { url: iconUrl, type: "image/svg+xml", sizes: "any" }];
    meta.appleWebApp = {
      capable: true,
      title: pwa.settings.short_name || pwa.settings.app_name || name,
      statusBarStyle: "default",
    };
  }
  return meta;
}

export async function generateViewport({ params }: { params: { slug: string } }): Promise<Viewport> {
  const pwa = await resolvePwaForRequest({ slugParam: params.slug });
  return { themeColor: pwa?.settings.theme_color || "#1d5c3a" };
}

export default async function TenantSitePage({ params }: { params: { slug: string } }) {
  // Site público de DEMONSTRAÇÃO: renderiza com os dados locais do visitante
  // (localStorage) sem tocar em nenhum tenant real.
  if (params.slug === "demonstracao") {
    const pwa = await resolvePwaForRequest({ slugParam: "demonstracao" });
    const { manifestUrl, swUrl, iconUrl } = pwaUrls(pwa?.basePath || "/demonstracao/");
    return (
      <>
        <DemoPublicSite />
        <PwaRegister
          enabled={Boolean(pwa?.settings.enabled)}
          slug="demonstracao"
          manifestUrl={manifestUrl}
          swUrl={swUrl}
          scope={pwa?.basePath || "/demonstracao/"}
          appName={pwa?.settings.app_name || "Demonstração"}
          themeColor={pwa?.settings.theme_color || "#1d5c3a"}
        />
        {/* pré-carrega o ícone dinâmico */}
        <link rel="prefetch" href={iconUrl} />
      </>
    );
  }

  const { tenant, access } = await resolveTenantAccess({ slug: params.slug });

  if (!tenant) {
    notFound();
  }

  const user = await getCurrentUser();
  const pwa = await resolvePwaForRequest({ slugParam: params.slug });

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
    const pwaEnabled = Boolean(pwa?.settings.enabled);
    const { manifestUrl, swUrl } = pwaUrls(pwa?.basePath || `/${params.slug}/`);
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
          extraNav={[{ label: "Painel", href: user ? "/painel" : "/login" }]}
        />
        <PwaRegister
          enabled={pwaEnabled}
          slug={params.slug}
          manifestUrl={manifestUrl}
          swUrl={swUrl}
          scope={pwa?.basePath || `/${params.slug}/`}
          appName={pwa?.settings.app_name || tenant.site_name || tenant.profile_name || params.slug}
          themeColor={pwa?.settings.theme_color || "#1d5c3a"}
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
