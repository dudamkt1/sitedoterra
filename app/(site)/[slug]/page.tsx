import type { Metadata, Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { SiteHome } from "@/components/site/SiteHome";
import { LoggedInNotice } from "@/components/site/LoggedInNotice";
import { SiteUnprepared } from "@/components/site/SiteUnprepared";
import { DemoPublicSite } from "@/components/demo/DemoPublicSite";
import { PwaRegister } from "@/components/site/PwaRegister";
import { resolveTenantAccess, getAffiliateLookupTenantBySlug } from "@/lib/tenant";
import { resolveHomeSections } from "@/lib/home";
import { getCurrentUser } from "@/lib/auth";
import { resolvePwaForRequest } from "@/lib/pwa/resolver";
import { pwaUrls } from "@/lib/pwa/config";
import { themePrimaryColor, type SiteThemeConfig } from "@/lib/site-theme";
import { resolveAffiliateDestination } from "@/lib/affiliate-destination";
import { getAffiliateSettings, isAffiliateInactiveSiteAllowed } from "@/lib/affiliate";

// Páginas públicas de tenants — ISR 60s (rápido + reflete edições do painel)
export const revalidate = 60;

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

  // PWA do usuário
  const pwa = await resolvePwaForRequest({ slugParam: params.slug });

  // HTML precisa expor o ícone do PWA para que:
  //  - iOS Safari use o apple-touch-icon 180x180 ao "Adicionar à Tela de Início"
  //    (iOS NÃO consulta o manifest na instalação — usa o apple-touch-icon)
  //  - Chrome Desktop mostre o favicon correto na aba
  // O PWA icon vem SEMPRE à frente do favicon do site; o favicon é fallback.
  const iconList: { url: string; type?: string; sizes?: string; rel?: string }[] = [];
  if (pwa?.settings.enabled) {
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
    // 32x32 favicon fallback
    if (pwa.settings.icon_192_url) {
      const bust = pwa.settings.icon_192_url.includes("?")
        ? `${pwa.settings.icon_192_url}&v=${v}`
        : `${pwa.settings.icon_192_url}?v=${v}`;
      iconList.push({ url: bust, type: "image/png", sizes: "32x32" });
    }
  }
  if (faviconUrl) {
    const bust = faviconUrl.includes("?") ? faviconUrl : `${faviconUrl}?v=2`;
    iconList.push({ url: bust, type: "image/png", sizes: "32x32" });
  }

  const meta: Metadata = {
    title: `${name} | Consultora doTERRA`,
    description: `Site oficial de ${name} — consultora doTERRA. Óleos essenciais puros, dicas de bem-estar e agendamento de consultas.`,
  };

  if (pwa?.settings.enabled) {
    const { manifestUrl } = pwaUrls(pwa.basePath);
    meta.manifest = manifestUrl;
    // Não adiciona SVG ao HTML — favicon PNG transparente já é o correto; SVG fica só no manifest como fallback maskable
    meta.appleWebApp = {
      capable: true,
      title: pwa.settings.short_name || pwa.settings.app_name || name,
      statusBarStyle: "default",
    };
  }

  if (iconList.length > 0) {
    meta.icons = iconList;
  }
  return meta;
}

export async function generateViewport({ params }: { params: { slug: string } }): Promise<Viewport> {
  const pwa = await resolvePwaForRequest({ slugParam: params.slug });
  let themeColor = pwa?.settings.theme_color || "#1d5c3a";
  try {
    const { tenant } = await resolveTenantAccess({ slug: params.slug });
    const theme = (tenant?.site_data as Record<string, unknown> | null)?.theme as SiteThemeConfig | undefined;
    if (theme) themeColor = themePrimaryColor(theme);
  } catch {}
  return { themeColor };
}

export default async function TenantSitePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { ref?: string };
}) {
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

  const ref = searchParams?.ref;
  const hasAffiliateRef = typeof ref === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(ref);

  // Paraleliza tenant + PWA + user para não somar waterfalls
  const [{ tenant, access }, user, pwa] = await Promise.all([
    resolveTenantAccess({ slug: params.slug }),
    getCurrentUser().catch(() => null),
    resolvePwaForRequest({ slugParam: params.slug }),
  ]);

  // Caso 1 — site público e ativo: render normal.
  if (tenant && access === "available") {
    const headerList = headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
    const protocol = headerList.get("x-forwarded-proto") || "https";
    const isVercelHost = host.endsWith(".vercel.app") || !host;
    const canonicalUrl = isVercelHost
      ? `${process.env.NEXT_PUBLIC_APP_URL || `https://${host}`}/${tenant.slug}`
      : `https://${host}`;

    // tenantDataOverridesGlobal=true: os dados do próprio tenant (site_settings,
    // editados em /painel/meu-site) têm prioridade sobre o template global.
    const sections = await resolveHomeSections({ tenant, tenantDataOverridesGlobal: true });
    const siteData = (tenant.site_data || {}) as Record<string, unknown>;
    const theme = (siteData.theme as SiteThemeConfig | undefined) || null;
    const pwaEnabled = Boolean(pwa?.settings.enabled);
    const { manifestUrl, swUrl } = pwaUrls(pwa?.basePath || `/${params.slug}/`);
    // Fallback inteligente: o AffiliateAttribution recebe o destino
    // (anchor "planos" ou outro) resolvido pelo servidor a partir da
    // configuração ATUAL da HOME. Se a seção Planos não estiver
    // habilitada, ele usa a Trustbar, Hero CTA, primeira seção visível
    // ou nenhum scroll.
    const destination = resolveAffiliateDestination({ sections, access });
    return (
      <>
        <link rel="canonical" href={canonicalUrl} />
        {user && <LoggedInNotice email={user.email} />}
        <SiteHome
          slug={tenant.slug}
          sections={sections}
          theme={theme}
          affiliateUserId={tenant.user_id}
          destination={destination}
          contact={{
            whatsapp: (siteData.whatsapp as string) || undefined,
            whatsapp_floating_enabled: (siteData.whatsapp_floating_enabled as boolean) || false,
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

  // Caso 2 — tenant existe mas está suspenso/pending/etc.
  // Se tem `?ref=`, renderiza SiteUnprepared (preserva o cookie de atribuição
  // e a venda pode ainda ser atribuída ao afiliado, caso a flag global permita).
  if (tenant && access !== "available") {
    const headerList = headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
    const isVercelHost = host.endsWith(".vercel.app") || !host;
    const canonicalUrl = isVercelHost
      ? `${process.env.NEXT_PUBLIC_APP_URL || `https://${host}`}/${tenant.slug}`
      : `https://${host}`;

    if (hasAffiliateRef) {
      // Verifica se o Super Admin permite indicações sem site ativo.
      // Se SIM: SiteUnprepared preserva `?ref=` e o cookie.
      // Se NÃO: redireciona para o domínio principal sem `?ref=`
      // (visitante não recebe atribuição alguma).
      const allowed = await isAffiliateInactiveSiteAllowed();
      if (!allowed) {
        redirect("/");
      }
      return (
        <>
          <link rel="canonical" href={canonicalUrl} />
          {user && <LoggedInNotice email={user.email} />}
          <SiteUnprepared tenant={tenant} destination={{ kind: "none", label: "site em preparação" }} />
        </>
      );
    }

    // Sem `?ref=`: exibe a página de fallback normalmente (sem atribuição).
    return (
      <>
        <link rel="canonical" href={canonicalUrl} />
        {user && <LoggedInNotice email={user.email} />}
        <SiteUnprepared tenant={tenant} destination={{ kind: "none", label: "site em preparação" }} />
      </>
    );
  }

  // Caso 3 — tenant NÃO existe (slug livre ou inexistente).
  // Se tem `?ref=` válido, procuramos o afiliado por user_id para descobrir
  // o tenant dele e ainda preservar a atribuição. Isso evita o 404 que
  // acontecia quando o visitante chegava pelo link `/afiliado1?ref=...`
  // sem o site estar publicamente ativo.
  if (!tenant && hasAffiliateRef) {
    const settings = await getAffiliateSettings();
    const allowed = settings?.allow_inactive_site_affiliate !== false;
    if (!allowed) {
      // Permissão OFF: redireciona para o domínio principal (sem 404).
      redirect("/");
    }

    // Tenta resolver o tenant do afiliado (slug do link != slug do tenant
    // em alguns cenários). A RPC get_tenant_for_affiliate_lookup aceita
    // QUALQUER slug (mesmo inexistente) e retorna o tenant cujo slug bate.
    // Aqui o `params.slug` é o slug do LINK que o visitante abriu — pode
    // ou não bater com o tenant do afiliado. Vamos procurar:
    const lookup = await getAffiliateLookupTenantBySlug(params.slug);

    if (lookup) {
      // Renderiza fallback do afiliado (preserva `?ref=` e o cookie).
      const headerList = headers();
      const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
      const isVercelHost = host.endsWith(".vercel.app") || !host;
      const canonicalUrl = isVercelHost
        ? `${process.env.NEXT_PUBLIC_APP_URL || `https://${host}`}/${lookup.slug}`
        : `https://${host}`;
      return (
        <>
          <link rel="canonical" href={canonicalUrl} />
          {user && <LoggedInNotice email={user.email} />}
          <SiteUnprepared
            tenant={lookup}
            destination={{ kind: "none", label: "site em preparação" }}
          />
        </>
      );
    }

    // Slug realmente não existe como afiliado nem como tenant.
    // Como tem `?ref=` válido, mas o slug do link é totalmente inexistente
    // e a flag global está ON, ainda assim NÃO queremos 404: direciona
    // para o domínio principal mantendo o cookie first-party.
    // (O AffiliateAttribution já foi executado pelo client na HOME do
    // domínio principal ao redirecionar via middleware/redirect.)
    redirect("/");
  }

  // Caso 4 — sem tenant E sem `?ref=`: 404 legítimo.
  notFound();
}
