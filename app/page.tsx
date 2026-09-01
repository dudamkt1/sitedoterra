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

// HOME é pública — ISR 60s + cache em memória deixam TTFB instantâneo e ainda refletem edições do painel
export const revalidate = 60;

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
  user_id: "demo-user-id",
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
  try {
    const homeSlug = process.env.HOME_TENANT_SLUG || "usuarioteste";
    const tenant = await getPublicTenantBySlug(homeSlug).catch(() => null);
    const siteData = (tenant?.site_data as Record<string, unknown> | null) || {};
    const faviconUrl = (siteData.faviconUrl as string) || undefined;

    const pwa = await resolveHomePwa();
    // FAVICON PNG transparente do painel — HTML usa só ele (não SVG) para não sobrepor o PNG
    const iconList: { url: string; type?: string; sizes?: string; rel?: string }[] = [];
    if (faviconUrl) {
      const bust = faviconUrl.includes("?") ? faviconUrl : `${faviconUrl}?v=2`;
      iconList.push({ url: bust, type: "image/png", sizes: "32x32" });
      iconList.push({ url: bust, type: "image/png", sizes: "192x192" });
    }
    if (pwa?.settings.enabled) {
      const { manifestUrl } = pwaUrls(pwa.basePath);
      const ts = pwa.settings.updated_at ? new Date(pwa.settings.updated_at).getTime() : Date.now();
      const v = Number.isNaN(ts) ? Date.now().toString(36) : ts.toString(36);

      // apple-touch-icon 180x180 (iOS "Adicionar à Tela de Início")
      if (pwa.settings.icon_180_url) {
        const bust = pwa.settings.icon_180_url.includes("?")
          ? `${pwa.settings.icon_180_url}&v=${v}`
          : `${pwa.settings.icon_180_url}?v=${v}`;
        iconList.push({ url: bust, type: "image/png", sizes: "180x180", rel: "apple-touch-icon" });
      }
      // 192x192 (Android legacy)
      if (pwa.settings.icon_192_url) {
        const bust = pwa.settings.icon_192_url.includes("?")
          ? `${pwa.settings.icon_192_url}&v=${v}`
          : `${pwa.settings.icon_192_url}?v=${v}`;
        iconList.push({ url: bust, type: "image/png", sizes: "192x192" });
      }
      // 512x512 (Android splash/home)
      if (pwa.settings.icon_512_url) {
        const bust = pwa.settings.icon_512_url.includes("?")
          ? `${pwa.settings.icon_512_url}&v=${v}`
          : `${pwa.settings.icon_512_url}?v=${v}`;
        iconList.push({ url: bust, type: "image/png", sizes: "512x512" });
      }

      // Manifest já contém os PNGs 192/512 + SVG maskable; no HTML deixamos só o favicon PNG transparente
      return {
        manifest: manifestUrl,
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
      const homeSlug = process.env.HOME_TENANT_SLUG || "usuarioteste";
      const tenant = await getPublicTenantBySlug(homeSlug);
      const theme = (tenant?.site_data as Record<string, unknown> | null)?.theme as SiteThemeConfig | undefined;
      if (theme) themeColor = themePrimaryColor(theme);
    } catch {}
    return { themeColor };
  } catch {
    return { themeColor: "#1d5c3a" };
  }
}

export default async function HomePage() {
  // getCurrentUser é opcional na HOME (só mostra "Logado como"); não bloqueia render se Supabase estiver lento
  const userPromise = getCurrentUser().catch(() => null);

  const homeSlug = process.env.HOME_TENANT_SLUG || "usuarioteste";
  // Paraleliza tenant + PWA para cortar ~300ms de waterfall
  const [tenantRaw, pwa] = await Promise.all([getPublicTenantBySlug(homeSlug), resolveHomePwa()]);
  const tenant = tenantRaw || DEMO_TENANT;
  const pwaEnabled = Boolean(pwa?.settings.enabled);
  const { manifestUrl, swUrl } = pwaUrls(pwa?.basePath || "/");

  const sections = await resolveHomeSections({ tenant, tenantDataOverridesGlobal: true });
  const siteData = (tenant.site_data || {}) as Record<string, unknown>;
  const theme = (siteData.theme as SiteThemeConfig | undefined) || null;
  const user = await userPromise;

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
