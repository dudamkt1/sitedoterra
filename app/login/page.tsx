import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
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
  title: "Entrar | TopConsultores",
  description: "Acesse sua conta para gerenciar seu site e assinatura.",
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

export default async function LoginPage() {
  const user = await getCurrentUser();

  // --- Cabeçalho e rodapé SINCRONIZADOS com a HOME (mesma fonte de verdade) ---
  const homeSlug = process.env.HOME_TENANT_SLUG || "usuarioteste";
  const tenantRaw = await getPublicTenantBySlug(homeSlug);
  const tenant = tenantRaw || DEMO_TENANT;
  const sections = await resolveHomeSections({ tenant, tenantDataOverridesGlobal: true, ignoreTenantOverrides: true });
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
  const logoLightUrl = (siteData.logoLightUrl as string) || (headerContent.logoLightUrl as string) || undefined;

  // Nav da HOME (mesma ordem/labels) — no login prefixa "/" para navegar de volta à HOME
  const homeNavItems = visible
    .filter((s) => s.settings?.showInNav !== false && s.type !== "header" && s.type !== "footer" && s.type !== "affiliates")
    .map((s) => ({ label: (s.navLabel || s.label) as string, href: `#${s.anchor}` }));
  const navItems = [...homeNavItems.map((i) => ({ ...i, href: `/${i.href}` })), { label: "Afiliados", href: "/afiliados" }];

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
    <div className="min-h-screen flex flex-col">
      {/* Header sob #tenant-site (estilos do site). O <main> fica FORA de
          #tenant-site de propósito: o reset global `#tenant-site *{margin:0;padding:0}`
          tem especificidade de ID e anula os paddings/margins do Tailwind. */}
      <div id="tenant-site" data-slug={tenant.slug}>
        <style dangerouslySetInnerHTML={{ __html: themeStyleTag(theme) }} />
        {/* Garante contraste do NAV fixo sobre fundo claro (sem alterar componente) */}
        <style dangerouslySetInnerHTML={{ __html: `#tenant-site nav:not(.scrolled){background:rgba(247,242,234,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(196,150,58,0.15);} #tenant-site nav:not(.scrolled) .nav-logo{color:var(--verde);} #tenant-site nav:not(.scrolled) .nav-links a{color:var(--cinza);} #tenant-site nav:not(.scrolled) .nav-links a:hover{color:var(--verde);} #tenant-site nav:not(.scrolled) .hamburger span{background:var(--verde);} #tenant-site nav:not(.scrolled) .nav-extra-link{color:var(--ouro);border-color:rgba(196,150,58,0.4);} ` }} />
        <SiteEffects />
        <Header logoText={logoText} logoUrl={logoUrl} logoLightUrl={logoLightUrl} navItems={navItems} extraNav={extraNav} />
      </div>
      {/* Isolado do NAV fixo (70px) — fundo suave com profundidade, respiro generoso */}
      <main className="flex-1 bg-gradient-to-b from-[#fcf9f5] via-[#f7f3ea] to-[#fcf9f5] pt-[70px] relative overflow-hidden">
        {/* Detalhe decorativo sutil */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-72 w-[720px] -translate-x-1/2 rounded-full bg-[#1d5c3a]/[0.05] blur-3xl" />
          <div className="absolute top-48 -left-24 h-64 w-64 rounded-full bg-[#c4963a]/[0.07] blur-3xl" />
          <div className="absolute top-72 -right-24 h-64 w-64 rounded-full bg-[#1d5c3a]/[0.06] blur-3xl" />
        </div>
        <div className="relative max-w-[1160px] mx-auto px-4 sm:px-8 lg:px-10 pt-10 sm:pt-14 lg:pt-16 pb-16 sm:pb-24 flex flex-col items-center">
          <div className="w-full max-w-[540px] px-1 sm:px-0">
            <Suspense fallback={<div className="py-12 text-center text-sm text-slate-500">Carregando...</div>}>
              <LoginForm />
            </Suspense>
          </div>
          {/* Selos de confiança */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 px-4 text-[12px] text-[#6b7a89]">
            <span className="inline-flex items-center gap-1.5 leading-5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1d5c3a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              Ambiente seguro
            </span>
            <span className="hidden sm:inline w-1 h-1 rounded-full bg-[#cbd5d1]" aria-hidden />
            <span className="leading-5">Seus dados protegidos com criptografia</span>
            <span className="hidden sm:inline w-1 h-1 rounded-full bg-[#cbd5d1]" aria-hidden />
            <span className="leading-5">Suporte via WhatsApp</span>
          </div>
        </div>
      </main>
      {/* Rodapé sob #tenant-site (estilos do site), bloco separado do header */}
      <div id="tenant-site" data-slug={tenant.slug}>
      <Footer
        content={footerContent as never}
        navItems={footerNavItems}
        contactWhatsapp={whatsapp}
        contactEmail={email}
        contactInstagram={instagram}
        profileName={profileName}
      />
      </div>
    </div>
  );
}
