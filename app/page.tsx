import type { Metadata, Viewport } from "next";
import { getCurrentUser } from "@/lib/auth";
import { SiteHome } from "@/components/site/SiteHome";
import { LoggedInNotice } from "@/components/site/LoggedInNotice";
import { SiteUnprepared } from "@/components/site/SiteUnprepared";
import { PwaRegister } from "@/components/site/PwaRegister";
import { DEFAULT_SITE_DATA } from "@/lib/site-data";
import { resolveModelLogo } from "@/lib/site-data";
import { resolveHomeSections } from "@/lib/home";
import { getPublicTenantBySlug } from "@/lib/tenant";
import { getOfficialHomeTenant } from "@/lib/site-official";
import { resolvePwaForRequest } from "@/lib/pwa/resolver";
import { pwaUrls, pwaIconPaths, pwaVersionToken } from "@/lib/pwa/config";
import { themePrimaryColor, type SiteThemeConfig } from "@/lib/site-theme";
import { getPublicBaseUrl } from "@/lib/public-url";
import { resolveAffiliateDestination } from "@/lib/affiliate-destination";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRaffleSettings } from "@/lib/crm-raffle";
import { AffiliateAttribution } from "@/components/site/AffiliateAttribution";
import type { PublicTenant } from "@/types";
import "@/app/(site)/site.css";

// HOME é pública — ISR 60s + cache em memória deixam TTFB instantâneo e ainda refletem edições do painel
export const revalidate = 60;

// Fallback estático FINAL — só usado se Supabase falhar ou nenhum tenant
// oficial estiver configurado.
const DEMO_TENANT: PublicTenant = {
  tenant_id: "index",
  slug: "index",
  site_name: "TopConsultores",
  site_status: "active",
  settings: {},
  site_data: DEFAULT_SITE_DATA as Record<string, unknown>,
  profile_name: "TopConsultores",
  email: "",
  monthly_billing_enabled: true,
  user_id: "demo-user-id",
};

/**
 * HOME da plataforma.
 *
 * Fonte única de verdade: `lib/site-official.ts#getOfficialHomeTenant` resolve
 * o tenant oficial a partir de:
 *   1) `tenants.is_official_home = true`
 *   2) `platform_config.home_tenant_slug`
 *   3) Tenant de qualquer super admin (fallback)
 *   4) DEMO_TENANT estático (último recurso)
 *
 * O slug resolvido é exposto via header `x-official-home-slug` para que a
 * rota `app/(site)/[slug]/page.tsx` possa sincronizar com a Home quando o
 * visitante acessa um site pertencente ao super admin.
 */

async function resolveHomePwa() {
  return resolvePwaForRequest({ home: true });
}

async function resolveHomeTenant(): Promise<{ tenant: PublicTenant; slug: string }> {
  const official = await getOfficialHomeTenant();
  const slug = (official as { slug?: string }).slug || "";
  return { tenant: official, slug };
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { tenant } = await resolveHomeTenant();
    const siteData = (tenant?.site_data as Record<string, unknown> | null) || {};
    const faviconUrl = (siteData.faviconUrl as string) || undefined;

    const pwa = await resolveHomePwa();
    const iconList: { url: string; type?: string; sizes?: string; rel?: string }[] = [];
    if (faviconUrl) {
      const bust = faviconUrl.includes("?") ? faviconUrl : `${faviconUrl}?v=2`;
      iconList.push({ url: bust, type: "image/png", sizes: "32x32" });
      iconList.push({ url: bust, type: "image/png", sizes: "192x192" });
    }
    if (pwa?.settings.enabled) {
      const v = pwaVersionToken(pwa.settings);
      const paths = pwaIconPaths(pwa.basePath);
      const withV = (rel: string) => `${rel}?v=${v}`;

      // Ícones SEMPRE same-origin (proxy normalizado ou tile gerado) —
      // iOS exige apple-touch-icon PNG; Android exige 192+512 PNG.
      iconList.push({ url: withV(paths.apple), type: "image/png", sizes: "180x180", rel: "apple-touch-icon" });
      iconList.push({ url: withV(paths.icon192), type: "image/png", sizes: "192x192" });
      iconList.push({ url: withV(paths.icon512), type: "image/png", sizes: "512x512" });

      return {
        // REGRA: NÃO usar metadata.manifest aqui. O Next 14 (basic.js) emite
        // <link rel="manifest" crossorigin="use-credentials"> para QUALQUER
        // valor de metadata.manifest, e esse atributo faz o fetcher do Google
        // (WebAPK) buscar o manifest em modo CORS com credenciais — a rota
        // responde Access-Control-Allow-Origin: * SEM Allow-Credentials, ou
        // seja, CORS REPROVADO → o servidor do Google não lê o manifest e
        // instala o app SEM o logotipo do usuário. O link é renderizado no
        // JSX da página (o React/Next move para o <head>) sem crossorigin.
        icons: iconList.length ? iconList : undefined,
        appleWebApp: {
          capable: true,
          title: pwa.settings.short_name || pwa.settings.app_name,
          statusBarStyle: "default",
        },
        other: { "apple-mobile-web-app-capable": "yes" },
      };
    }
    if (iconList.length) return { icons: iconList };
    return {};
  } catch {
    return {};
  }
}

export async function generateViewport(): Promise<Viewport> {
  try {
    const pwa = await resolveHomePwa();
    let themeColor = pwa?.settings.theme_color || "#1d5c3a";
    try {
      const { tenant } = await resolveHomeTenant();
      const theme = (tenant?.site_data as Record<string, unknown> | null)?.theme as SiteThemeConfig | undefined;
      if (theme) themeColor = themePrimaryColor(theme);
    } catch {}
    return { themeColor };
  } catch {
    return { themeColor: "#1d5c3a" };
  }
}

export default async function HomePage() {
  const userPromise = getCurrentUser().catch(() => null);

  const [homeResolved, pwa] = await Promise.all([resolveHomeTenant(), resolveHomePwa()]);
  const tenant = homeResolved.tenant;
  const homeSlug = homeResolved.slug;
  const pwaEnabled = Boolean(pwa?.settings.enabled);
  const { manifestUrl, swUrl } = pwaUrls(pwa?.basePath || "/");

  const sections = await resolveHomeSections({ tenant, tenantDataOverridesGlobal: true, ignoreTenantOverrides: true });
  const siteData = (tenant.site_data || {}) as Record<string, unknown>;
  const theme = (siteData.theme as SiteThemeConfig | undefined) || null;
  const user = await userPromise;

  const canonicalUrl = getPublicBaseUrl();

  const isDemoFallback = tenant === DEMO_TENANT;
  const siteIsActive = isDemoFallback || tenant.site_status === "active";

  if (!siteIsActive && !isDemoFallback) {
    return (
      <>
        <link rel="canonical" href={canonicalUrl} />
        {user && <LoggedInNotice email={user.email} returnTo="/" />}
        <AffiliateAttribution
          destination={{ kind: "anchor", anchor: "planos", label: "planos" }}
        />
        <SiteUnprepared
          tenant={tenant}
          destination={{ kind: "none", label: "site em preparação" }}
        />
      </>
    );
  }

  // Rodapé 1ª coluna: nome + descrição de "Informações do site".
  const ownerName =
    (siteData.fullName as string) ||
    ([siteData.name, siteData.surname].filter(Boolean).join(" ") as string) ||
    undefined;
  const aboutDescription = (siteData.description as string) || undefined;

  const destination = resolveAffiliateDestination({ sections, access: "available" });

  // Sorteio: NAV só lista a seção com conteúdo visível (mesma regra do /[slug]).
  // Na HOME oficial, seção global ativa sem config vira VITRINE de exemplo
  // (o que o /admin/editor-home liga aparece no domínio principal).
  let loyaltyRaffleLive: boolean | undefined = undefined;
  const raffleSectionOn = sections.some((s) => s.type === "loyalty_raffle" && s.enabled);
  if (raffleSectionOn) {
    try {
      loyaltyRaffleLive = (await getRaffleSettings(createAdminClient(), tenant.tenant_id)).enabled;
    } catch {
      loyaltyRaffleLive = undefined;
    }
  }
  const loyaltyRaffleSample = raffleSectionOn && loyaltyRaffleLive !== true;

  // Logo 100% do modelo (/admin/editor-home → Cabeçalho/Menu); o tenant
  // oficial só complementa quando o modelo ainda não tem logo.
  const headerContent = ((sections.find((s) => s.type === "header")?.content || {}) as Record<string, unknown>) || {};
  const modelLogo = resolveModelLogo(headerContent, siteData, tenant.profile_name || tenant.site_name || undefined);

  return (
    <>
      <link rel="canonical" href={canonicalUrl} />
      {pwaEnabled && <link rel="manifest" href={manifestUrl} />}
      {user && <LoggedInNotice email={user.email} returnTo="/" />}
      <SiteHome
        slug={tenant.slug}
        sections={sections}
        theme={theme}
        affiliateUserId={tenant.user_id}
        destination={destination}
        loyaltyRaffleLive={loyaltyRaffleLive}
        loyaltyRaffleSample={loyaltyRaffleSample}
        sorteioHref="/sorteio"
        contact={{
          whatsapp: (siteData.whatsapp as string) || undefined,
          whatsapp_floating_enabled: (siteData.whatsapp_floating_enabled as boolean) || false,
          email: (siteData.email as string) || tenant.email || undefined,
          instagram: siteData.instagram ? `https://instagram.com/${String(siteData.instagram).replace(/^@/, "")}` : undefined,
          profileName: tenant.profile_name || undefined,
        }}
        logo={{
          mode: modelLogo.mode,
          url: modelLogo.url,
          lightUrl: modelLogo.lightUrl,
          text: modelLogo.text,
        }}
        ownerName={ownerName}
        aboutDescription={aboutDescription}
        extraNav={[{ label: "Painel", href: user ? "/painel" : "/login" }]}
      />
      <PwaRegister
        enabled={pwaEnabled}
        slug={homeSlug || "home"}
        manifestUrl={manifestUrl}
        swUrl={swUrl}
        scope={pwa?.basePath || "/"}
        appName={pwa?.settings.app_name || tenant.site_name || tenant.profile_name || "TopConsultores"
        }
        themeColor={pwa?.settings.theme_color || "#1d5c3a"}
      />
    </>
  );
}
