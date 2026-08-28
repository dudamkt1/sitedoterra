import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getPublicTenantBySlug } from "@/lib/tenant";
import { resolveHomeSections } from "@/lib/home";
import { DEFAULT_SITE_DATA } from "@/lib/site-data";
import { themePrimaryColor, themeStyleTag, type SiteThemeConfig } from "@/lib/site-theme";
import { Suspense } from "react";
import { Header } from "@/components/site/sections/Header";
import { Footer } from "@/components/site/sections/Footer";
import CheckoutPageClient from "./CheckoutPageClient";
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
  const tenant = (await getPublicTenantBySlug(homeSlug)) || (DEMO_TENANT as unknown as typeof tenant & { tenant_id: string });
  const sections = await resolveHomeSections({ tenant: tenant as unknown as Parameters<typeof resolveHomeSections>[0]["tenant"], tenantDataOverridesGlobal: true });
  const siteData = ((tenant as unknown as { site_data?: Record<string, unknown> }).site_data || {}) as Record<string, unknown>;
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
  const email = (siteData.email as string) || ((tenant as unknown as { email?: string }).email as string) || undefined;
  const instagram = siteData.instagram ? `https://instagram.com/${String(siteData.instagram).replace(/^@/, "")}` : (footerContent._contactInstagram as string) || undefined;
  const profileName = (siteData.logoText as string) || (footerContent._profileName as string) || undefined;

  const planId = searchParams?.planId || searchParams?.plan || undefined;

  return (
    <div id="tenant-site" data-slug={tenant.slug}>
      <style dangerouslySetInnerHTML={{ __html: themeStyleTag(theme) }} />
      <Header logoText={logoText} logoUrl={logoUrl} logoLightUrl={logoLightUrl} navItems={navItems} extraNav={[{ label: "Painel", href: user ? "/painel" : "/login" }]} />

      <main className="min-h-[70vh] bg-[#f6f4ef] pt-[86px] pb-12 sm:pb-16">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8">
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
