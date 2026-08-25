import type { Metadata, Viewport } from "next";
import { getCurrentUser } from "@/lib/auth";
import { SiteHome } from "@/components/site/SiteHome";
import { LoggedInNotice } from "@/components/site/LoggedInNotice";
import { PwaRegister } from "@/components/site/PwaRegister";
import { DEFAULT_SITE_DATA } from "@/lib/site-data";
import { resolveHomeSections } from "@/lib/home";
import { getPublicTenantBySlug } from "@/lib/tenant";
import { resolvePwaForRequest } from "@/lib/pwa/resolver";
import { pwaUrls } from "@/lib/pwa/config";
import { themePrimaryColor, type SiteThemeConfig } from "@/lib/site-theme";
import type { PublicTenant } from "@/types";
import "@/app/(site)/site.css";

export const dynamic = "force-dynamic";

const DEMO_TENANT: PublicTenant = {
  tenant_id: "index",
  slug: "index",
  site_name: "Ana Beatriz",
  site_status: "active",
  settings: {},
  site_data: DEFAULT_SITE_DATA as Record<string, unknown>,
  profile_name: "Ana Beatriz",
  email: "contato@anabeatriz.com.br",
  monthly_billing_enabled: true,
};

/**
 * HOME da plataforma (página pública "/").
 *
 * A HOME é SINCRONIZADA com o usuário de demonstração: resolve o tenant real
 * pelo slug configurado (HOME_TENANT_SLUG, padrão "usuarioteste") e renderiza
 * com tenantDataOverridesGlobal=true — exatamente como a rota pública
 * "/[slug]". Assim, o que é configurado em /painel/meu-site aparece tanto na
 * HOME quanto na URL do usuário, sempre idêntico.
 *
 * Se o tenant de demonstração não estiver disponível (ex.: sem Supabase ou
 * suspenso), cai no DEMO_TENANT estático com o conteúdo padrão.
 *
 * PWA: quando o app está ativo, a HOME também convida à instalação — o
 * manifest/service worker são servidos na RAIZ (scope "/") e o app instalado
 * abre direto no domínio principal.
 */

async function resolveHomePwa() {
  return resolvePwaForRequest({ home: true });
}

export async function generateMetadata(): Promise<Metadata> {
  const pwa = await resolveHomePwa();
  if (!pwa?.settings.enabled) return {};
  const { manifestUrl, iconUrl } = pwaUrls(pwa.basePath);
  return {
    manifest: manifestUrl,
    icons: [{ url: iconUrl, type: "image/svg+xml", sizes: "any" }],
    appleWebApp: {
      capable: true,
      title: pwa.settings.short_name || pwa.settings.app_name,
      statusBarStyle: "default",
    },
    other: { "apple-mobile-web-app-capable": "yes" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const pwa = await resolveHomePwa();
  let themeColor = pwa?.settings.theme_color || "#1d5c3a";
  try {
    const homeSlug = process.env.HOME_TENANT_SLUG || "usuarioteste";
    const tenant = await getPublicTenantBySlug(homeSlug);
    const theme = (tenant?.site_data as Record<string, unknown> | null)?.theme as SiteThemeConfig | undefined;
    if (theme) themeColor = themePrimaryColor(theme);
  } catch {}
  return { themeColor };
}

export default async function HomePage() {
  const user = await getCurrentUser();

  const homeSlug = process.env.HOME_TENANT_SLUG || "usuarioteste";
  const tenant = (await getPublicTenantBySlug(homeSlug)) || DEMO_TENANT;
  const pwa = await resolveHomePwa();
  const pwaEnabled = Boolean(pwa?.settings.enabled);
  const { manifestUrl, swUrl } = pwaUrls(pwa?.basePath || "/");

  const sections = await resolveHomeSections({ tenant, tenantDataOverridesGlobal: true });
  const siteData = (tenant.site_data || {}) as Record<string, unknown>;
  const theme = (siteData.theme as SiteThemeConfig | undefined) || null;

  return (
    <>
      {user && <LoggedInNotice email={user.email} />}
      <SiteHome
        slug={tenant.slug}
        sections={sections}
        theme={theme}
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
        slug={homeSlug}
        manifestUrl={manifestUrl}
        swUrl={swUrl}
        scope={pwa?.basePath || "/"}
        appName={pwa?.settings.app_name || tenant.site_name || tenant.profile_name || "TopConsultores"}
        themeColor={pwa?.settings.theme_color || "#1d5c3a"}
      />
    </>
  );
}
