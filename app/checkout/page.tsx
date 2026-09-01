import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { Suspense } from "react";
import CheckoutPageClient from "./CheckoutPageClient";
import "@/app/(site)/site.css";
import { Header } from "@/components/site/sections/Header";
import { Footer } from "@/components/site/sections/Footer";
import { SiteEffects } from "@/components/site/sections/SiteEffects";
import { themeStyleTag, type SiteThemeConfig } from "@/lib/site-theme";
import { DEFAULT_SITE_DATA } from "@/lib/site-data";
import { resolveHomeSections } from "@/lib/home";
import { getPublicTenantBySlug } from "@/lib/tenant";
import type { PublicTenant } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout — Ative seu site | TopConsultores",
  description: "Finalize sua contratação com pagamento seguro. Ativação imediata após confirmação.",
  robots: { index: false, follow: false },
};

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

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: { planId?: string; plan?: string };
}) {
  const user = await getCurrentUser();
  const planId = searchParams?.planId || searchParams?.plan || undefined;

  // --- Cabeçalho e rodapé SINCRONIZADOS com a HOME (mesma fonte de verdade) — cache 60s ---
  const homeSlug = process.env.HOME_TENANT_SLUG || "usuarioteste";
  const tenantRaw = await getPublicTenantBySlug(homeSlug);
  const tenant = tenantRaw || DEMO_TENANT;
  const sections = await resolveHomeSections({ tenant, tenantDataOverridesGlobal: true });
  const siteData = (tenant.site_data || {}) as Record<string, unknown>;
  const theme = (siteData.theme as SiteThemeConfig | undefined) || null;

  const visible = sections.filter((s) => s.enabled);
  const headerSection = visible.find((s) => s.type === "header");
  const headerContent = (headerSection?.content || {}) as Record<string, unknown>;
  const logoText = (siteData.logoText as string) || (headerContent.logoText as string) || (headerSection?.label as string) || tenant.profile_name || tenant.site_name || "Logo";
  const logoUrl =
    (siteData.logoMode as string) === "text"
      ? undefined
      : (siteData.logoUrl as string) || (headerContent.logoUrl as string) || undefined;
  const logoLightUrl = (siteData.logoLightUrl as string) || undefined;

  // Nav da HOME (mesma ordem/labels) — no checkout prefixa "/" para navegar de volta à HOME
  const homeNavItems = visible
    .filter((s) => s.settings?.showInNav !== false && s.type !== "header" && s.type !== "footer")
    .map((s) => ({ label: (s.navLabel || s.label) as string, href: `#${s.anchor}` }));
  const navItems = homeNavItems.map((i) => ({ ...i, href: `/${i.href}` }));

  const extraNav = [{ label: "Painel", href: user ? "/painel" : "/login" }];

  const footerSection = visible.find((s) => s.type === "footer");
  const footerContent = (footerSection?.content || {}) as Record<string, unknown>;
  const whatsapp = (siteData.whatsapp as string) || (footerContent._contactWhatsapp as string) || undefined;
  const email = (siteData.email as string) || tenant.email || (footerContent._contactEmail as string) || undefined;
  const instagram = siteData.instagram
    ? `https://instagram.com/${String(siteData.instagram).replace(/^@/, "")}`
    : (footerContent._contactInstagram as string) || undefined;
  const profileName = tenant.profile_name || (footerContent._profileName as string) || (headerContent.logoText as string) || undefined;

  const footerNavItems = homeNavItems.map((i) => ({ ...i, href: `/${i.href}` }));

  return (
    <div id="tenant-site" data-slug={tenant.slug} className="min-h-screen flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: themeStyleTag(theme) }} />
      {/* Garante contraste do NAV fixo sobre fundo claro do checkout (sem alterar componente) */}
      <style dangerouslySetInnerHTML={{ __html: `#tenant-site nav:not(.scrolled){background:rgba(247,242,234,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(196,150,58,0.15);} #tenant-site nav:not(.scrolled) .nav-logo{color:var(--verde);} #tenant-site nav:not(.scrolled) .nav-links a{color:var(--cinza);} #tenant-site nav:not(.scrolled) .nav-links a:hover{color:var(--verde);} #tenant-site nav:not(.scrolled) .hamburger span{background:var(--verde);} #tenant-site nav:not(.scrolled) .nav-extra-link{color:var(--ouro);border-color:rgba(196,150,58,0.4);} ` }} />
      <SiteEffects />
      <Header logoText={logoText} logoUrl={logoUrl} logoLightUrl={logoLightUrl} navItems={navItems} extraNav={extraNav} />
      {/* Isolado do NAV fixo (70px) + respiro generoso — checkout central 100% checkout.png, centralizado, sem invadir rodapé */}
      <main className="flex-1 bg-[#fcf9f5] pt-[70px]">
        <div className="max-w-[1160px] mx-auto px-5 sm:px-6 lg:px-8 pt-12 sm:pt-14 pb-16 sm:pb-20 flex justify-center">
          <div className="w-full max-w-[980px]">
            <Suspense fallback={<div className="max-w-[640px] mx-auto py-12 text-center text-sm text-slate-500">Carregando checkout...</div>}>
              <CheckoutPageClient planIdParam={planId} />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer
        content={footerContent as never}
        navItems={footerNavItems}
        contactWhatsapp={whatsapp}
        contactEmail={email}
        contactInstagram={instagram}
        profileName={profileName}
      />
    </div>
  );
}
