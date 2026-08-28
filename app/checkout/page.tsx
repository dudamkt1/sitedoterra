import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getPublicTenantBySlug } from "@/lib/tenant";
import { resolveHomeSections } from "@/lib/home";
import { DEFAULT_SITE_DATA } from "@/lib/site-data";
import { themeStyleTag, type SiteThemeConfig } from "@/lib/site-theme";
import { Suspense } from "react";
import { Header } from "@/components/site/sections/Header";
import { Footer } from "@/components/site/sections/Footer";
import CheckoutPageClient from "./CheckoutPageClient";
import type { PublicTenant } from "@/types";
import "@/app/(site)/site.css";

export const dynamic = "force-dynamic";

const DEMO_TENANT = {
  tenant_id: "index",
  slug: "index",
  site_name: "Ana Beatriz",
  site_status: "active" as const,
  settings: {},
  site_data: DEFAULT_SITE_DATA as Record<string, unknown>,
  profile_name: "Ana Beatriz",
  email: "contato@anabeatriz.com.br",
  monthly_billing_enabled: true,
};

export const metadata: Metadata = {
  title: "Checkout — Ative seu site | TopConsultores",
  description: "Finalize sua contratação com pagamento seguro. Ativação imediata após confirmação.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: { planId?: string; plan?: string };
}) {
  const user = await getCurrentUser();
  const homeSlug = process.env.HOME_TENANT_SLUG || "usuarioteste";
  const fetchedTenant: PublicTenant | null = await getPublicTenantBySlug(homeSlug);
  const tenant: PublicTenant = (fetchedTenant as PublicTenant | null) || (DEMO_TENANT as unknown as PublicTenant);
  const sections = await resolveHomeSections({ tenant, tenantDataOverridesGlobal: true });
  const siteData = ((tenant.site_data || {}) as Record<string, unknown>);
  const theme = (siteData.theme as SiteThemeConfig | undefined) || null;

  const headerSection = sections.find((s) => s.type === "header");
  const headerContent = (headerSection?.content || {}) as Record<string, unknown>;
  const logoText = (siteData.logoText as string) || (headerContent.logoText as string) || (headerSection?.label as string) || "TopConsultores";
  const logoUrl =
    (siteData.logoMode as string) === "text"
      ? undefined
      : (siteData.logoUrl as string) || (headerContent.logoUrl as string) || undefined;
  const logoLightUrl = (siteData.logoLightUrl as string) || undefined;

  const navItems = sections
    .filter((s) => s.settings?.showInNav !== false && s.type !== "header" && s.type !== "footer")
    .map((s) => ({ label: (s.navLabel || s.label) as string, href: `/#${s.anchor}` }));

  const footerSection = sections.find((s) => s.type === "footer");
  const footerContent = (footerSection?.content || {}) as Record<string, unknown>;
  const whatsapp = (siteData.whatsapp as string) || (footerContent._contactWhatsapp as string) || undefined;
  const email = (siteData.email as string) || (tenant.email as string) || undefined;
  const instagram = siteData.instagram ? `https://instagram.com/${String(siteData.instagram).replace(/^@/, "")}` : (footerContent._contactInstagram as string) || undefined;
  const profileName = (tenant.profile_name as string) || (footerContent._profileName as string) || undefined;

  const planId = searchParams?.planId || searchParams?.plan || undefined;

  return (
    <div id="tenant-site" data-slug={tenant.slug} className="checkout-page">
      <style dangerouslySetInnerHTML={{ __html: themeStyleTag(theme) }} />
      {/* Checkout precisa de header sólido desde o topo — evita invasão e texto branco sobre fundo claro */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            #tenant-site.checkout-page nav { background: rgba(255,255,255,0.96) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid #e5e7eb; box-shadow: 0 1px 12px rgba(0,0,0,0.04); }
            #tenant-site.checkout-page nav .nav-logo { color: var(--verde) !important; }
            #tenant-site.checkout-page nav .nav-links a { color: #6b7280 !important; }
            #tenant-site.checkout-page nav .nav-links a:hover { color: var(--verde) !important; }
            #tenant-site.checkout-page nav .nav-links a::after { background: var(--verde); }
            #tenant-site.checkout-page nav .hamburger { background: #f3f4f6; }
            #tenant-site.checkout-page nav .hamburger span { background: var(--verde) !important; }
            #tenant-site.checkout-page nav .nav-extra-link { color: var(--verde) !important; border-color: rgba(29,92,58,0.18) !important; background: #f9fafb !important; }
            #tenant-site.checkout-page nav .nav-extra-link:hover { background: var(--verde) !important; color: #fff !important; }
            #tenant-site.checkout-page nav .nav-badge { background: var(--verde) !important; }
          `,
        }}
      />
      <Header logoText={logoText} logoUrl={logoUrl} logoLightUrl={logoLightUrl} navItems={navItems} extraNav={[{ label: "Painel", href: user ? "/painel" : "/login" }]} />

      <main className="min-h-[70vh] bg-[#fdfcfa] sm:bg-[#f8f7f5] pt-[88px] sm:pt-[104px] pb-12 sm:pb-16 lg:pb-20">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<div className="max-w-[640px] mx-auto py-12 text-center text-sm text-slate-500">Carregando checkout...</div>}>
            <CheckoutPageClient planIdParam={planId} />
          </Suspense>
        </div>
      </main>

      <Footer
        content={footerContent as never}
        navItems={navItems}
        contactWhatsapp={whatsapp}
        contactEmail={email}
        contactInstagram={instagram}
        profileName={profileName}
      />
    </div>
  );
}
