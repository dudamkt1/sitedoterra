import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { Suspense } from "react";
import "@/app/(site)/site.css";
import { Header } from "@/components/site/sections/Header";
import { Footer } from "@/components/site/sections/Footer";
import { SiteEffects } from "@/components/site/sections/SiteEffects";
import { themeStyleTag, type SiteThemeConfig } from "@/lib/site-theme";
import { DEFAULT_SITE_DATA } from "@/lib/site-data";
import { resolveHomeSections } from "@/lib/home";
import { getPublicTenantBySlug } from "@/lib/tenant";
import { getPublicAffiliateConfig } from "@/lib/affiliate-public";
import { AffiliatesCalculator } from "@/components/afiliados/AffiliatesCalculator";
import { AffiliatesFaq } from "@/components/afiliados/AffiliatesFaq";
import type { PublicTenant } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Programa de Afiliados | TopConsultores",
  description: "Indique consultores para o TopConsultores e receba comissão via Pix a cada ativação. Sem limite, sem taxa.",
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

export default async function AfiliadosPage() {
  const user = await getCurrentUser();
  const ctaHref = user ? "/painel/afiliados" : "/login?next=/painel/afiliados";

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

  const homeNavItems = visible
    .filter((s) => s.settings?.showInNav !== false && s.type !== "header" && s.type !== "footer" && s.type !== "affiliates")
    .map((s) => ({ label: (s.navLabel || s.label) as string, href: `#${s.anchor}` }));
  const navItems = [...homeNavItems.map((i) => ({ ...i, href: `/${i.href}` })), { label: "Afiliados", href: "/afiliados" }];

  const footerSection = visible.find((s) => s.type === "footer");
  const footerContent = (footerSection?.content || {}) as Record<string, unknown>;
  const whatsapp = (siteData.whatsapp as string) || (footerContent._contactWhatsapp as string) || undefined;
  const email = (siteData.email as string) || tenant.email || (footerContent._contactEmail as string) || undefined;
  const instagram = siteData.instagram
    ? `https://instagram.com/${String(siteData.instagram).replace(/^@/, "")}`
    : (footerContent._contactInstagram as string) || undefined;
  const profileName = tenant.profile_name || (footerContent._profileName as string) || (headerContent.logoText as string) || undefined;
  const footerNavItems = homeNavItems.map((i) => ({ ...i, href: `/${i.href}` }));

  // Config central do programa (percentual vigente + base de cálculo).
  const affConfig = await getPublicAffiliateConfig();
  const pct = affConfig.commission_percent;
  const activationCents = affConfig.activation_price_cents;
  const perSaleCents = Math.round((activationCents * pct) / 100);
  const minPayout = brl(Math.round(affConfig.min_payout_amount * 100));

  const steps = [
    { icon: "🔗", title: "Pegue seu link exclusivo", text: "No painel, seu link de afiliado é gerado automaticamente. Copie com um clique." },
    { icon: "💬", title: "Compartilhe com consultores", text: "Envie no WhatsApp, Instagram e grupos. Quem chegar pelo seu link fica vinculado a você." },
    { icon: "⚡", title: "Receba via Pix", text: `Quando sua indicação ativar o site, sua comissão de ${pct}% entra no painel automaticamente.` },
  ];

  const trust = [
    { icon: "📊", title: "Painel em tempo real", text: "Acompanhe cliques, cadastros, conversões e ganhos sem sair do painel." },
    { icon: "💸", title: "Pagamento via Pix", text: "Solicite o saque e receba direto na sua chave Pix, sem enrolação." },
    { icon: "🚀", title: "Ilimitado", text: "Sem teto de indicações e sem taxa de participação. Quanto mais indicar, mais ganha." },
  ];

  const faq = [
    { q: "Preciso ter site ativo no TopConsultores pra participar?", a: "Não. Basta ter sua conta criada. Seu link de afiliada é gerado no painel e você já pode começar a indicar." },
    { q: "Quando eu recebo a comissão?", a: `A comissão de ${pct}% é registrada no seu painel assim que a indicada ativa o site. Depois é só solicitar o saque e receber via Pix.` },
    { q: "Tem valor mínimo pra sacar?", a: `Sim, o saque mínimo atual é de ${minPayout}. Atingiu esse valor, pode solicitar a qualquer momento pelo painel.` },
    { q: "Posso indicar quantas pessoas eu quiser?", a: "Sim, não há limite de indicações. Cada ativação confirmada gera uma nova comissão para você." },
    { q: "E se a pessoa que eu indiquei cancelar depois?", a: "Comissões de ativações canceladas ou estornadas podem ser estornadas do seu saldo. Vale o que foi efetivamente confirmado." },
    { q: `O percentual de ${pct}% pode mudar?`, a: "Pode, pois é uma configuração do programa. Mas o percentual da sua venda fica congelado no momento da ativação — mudanças futuras não alteram comissões já registradas." },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <div id="tenant-site" data-slug={tenant.slug}>
        <style dangerouslySetInnerHTML={{ __html: themeStyleTag(theme) }} />
        <style dangerouslySetInnerHTML={{ __html: `#tenant-site nav:not(.scrolled){background:rgba(247,242,234,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(196,150,58,0.15);} #tenant-site nav:not(.scrolled) .nav-logo{color:var(--verde);} #tenant-site nav:not(.scrolled) .nav-links a{color:var(--cinza);} #tenant-site nav:not(.scrolled) .nav-links a:hover{color:var(--verde);} #tenant-site nav:not(.scrolled) .hamburger span{background:var(--verde);} #tenant-site nav:not(.scrolled) .nav-extra-link{color:var(--ouro);border-color:rgba(196,150,58,0.4);} ` }} />
        <SiteEffects />
        <Header logoText={logoText} logoUrl={logoUrl} logoLightUrl={logoLightUrl} navItems={navItems} extraNav={[{ label: "Painel", href: user ? "/painel" : "/login" }]} />
      </div>

      <main className="flex-1 bg-gradient-to-b from-[#fcf9f5] via-[#f7f3ea] to-[#fcf9f5] pt-[70px] relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-72 w-[720px] -translate-x-1/2 rounded-full bg-[#1d5c3a]/[0.05] blur-3xl" />
          <div className="absolute top-64 -left-24 h-64 w-64 rounded-full bg-[#c4963a]/[0.07] blur-3xl" />
          <div className="absolute top-[42rem] -right-24 h-64 w-64 rounded-full bg-[#1d5c3a]/[0.06] blur-3xl" />
        </div>

        <div className="relative max-w-[1160px] mx-auto px-4 sm:px-8 lg:px-10 pt-10 sm:pt-14 lg:pt-16 pb-16 sm:pb-24">
          <div className="w-full max-w-[880px] mx-auto">
            {/* ============ HERO ============ */}
            <div className="text-center px-2 sm:px-6">
              <p className="inline-flex items-center gap-2 rounded-full bg-[#eef6ee] border border-[#cfe6d4] px-4 py-1.5 text-[11.5px] sm:text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#1d5c3a]">
                🤝 Programa de Afiliados
              </p>
              <h1 className="mt-5 text-[28px] sm:text-[40px] lg:text-[44px] font-extrabold tracking-[-0.02em] text-[#0f1a2a] leading-[1.15]">
                Ganhe dinheiro indicando o site que você já usa
              </h1>
              <p className="mt-4 text-[14.5px] sm:text-[16.5px] leading-relaxed text-[#5a6b7a] max-w-[620px] mx-auto">
                Sem vender nada: é só compartilhar seu link. A cada indicação que ativar o site, você recebe {pct}% de comissão.
              </p>
              <a
                href={ctaHref}
                className="mt-7 inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#1d5c3a] hover:bg-[#154730] active:bg-[#103d2d] px-8 py-4 text-[15px] sm:text-[16px] font-bold text-white shadow-[0_10px_28px_rgba(29,92,58,0.28)] transition"
              >
                Quero ser afiliado <span aria-hidden>→</span>
              </a>
              <p className="mt-3 text-[12.5px] text-[#8a9aa8] leading-relaxed">
                Grátis · Sem taxa de participação · {brl(perSaleCents)} por ativação
              </p>
            </div>

            {/* ============ COMO FUNCIONA ============ */}
            <div className="mt-14 sm:mt-20">
              <p className="text-center text-[12px] sm:text-[13px] font-extrabold uppercase tracking-[0.18em] text-[#1d5c3a]/70">
                Como funciona
              </p>
              <h2 className="mt-2.5 text-center text-[22px] sm:text-[30px] font-extrabold tracking-tight text-[#0f1a2a] leading-snug px-2">
                3 passos e pronto
              </h2>
              <div className="mt-7 sm:mt-9 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                {steps.map((s, i) => (
                  <div key={s.title} className="relative rounded-[20px] bg-white/95 border border-[#e7ece8] shadow-[0_12px_32px_rgba(16,61,45,0.07)] p-6 sm:p-7">
                    <span className="absolute top-5 right-6 text-[12px] font-extrabold text-[#cbd5d1]">0{i + 1}</span>
                    <span className="w-12 h-12 rounded-2xl bg-[#eef6ee] border border-[#cfe6d4] flex items-center justify-center text-[22px]" aria-hidden>
                      {s.icon}
                    </span>
                    <p className="mt-4 text-[15px] font-bold text-[#0f1a2a] leading-snug">{s.title}</p>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-[#5a6b7a]">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ============ BLOCO COMISSÃO ============ */}
            <div className="mt-6 sm:mt-8 rounded-[24px] bg-gradient-to-br from-[#1d5c3a] via-[#154730] to-[#0d3320] px-6 py-8 sm:p-10 text-center shadow-[0_20px_56px_rgba(16,61,45,0.25)]">
              <p className="text-[12px] sm:text-[13px] font-extrabold uppercase tracking-[0.18em] text-[#e8c87a]">
                Sua comissão
              </p>
              <p className="mt-3 text-[30px] sm:text-[42px] font-extrabold text-white tracking-tight leading-tight">
                {pct}% por indicação
              </p>
              <p className="mt-3 text-[14px] sm:text-[15.5px] leading-relaxed text-white/80 max-w-[560px] mx-auto">
                {brl(perSaleCents)} a cada ativação confirmada ({brl(activationCents)}). Sem limite de indicações, sem taxa, sem burocracia.
              </p>
            </div>

            {/* ============ CALCULADORA ============ */}
            <div className="mt-6 sm:mt-8">
              <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">Carregando calculadora...</div>}>
                <AffiliatesCalculator commissionPercent={pct} activationPriceCents={activationCents} />
              </Suspense>
            </div>

            {/* ============ CONFIANÇA ============ */}
            <div className="mt-14 sm:mt-20">
              <p className="text-center text-[12px] sm:text-[13px] font-extrabold uppercase tracking-[0.18em] text-[#1d5c3a]/70">
                Por que funciona
              </p>
              <h2 className="mt-2.5 text-center text-[22px] sm:text-[30px] font-extrabold tracking-tight text-[#0f1a2a] leading-snug px-2">
                Transparente do clique ao Pix
              </h2>
              <div className="mt-7 sm:mt-9 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                {trust.map((t) => (
                  <div key={t.title} className="flex gap-3.5 items-start rounded-[20px] bg-white/95 border border-[#e7ece8] shadow-[0_12px_32px_rgba(16,61,45,0.07)] px-6 py-6">
                    <span className="w-10 h-10 rounded-xl bg-[#eef6ee] border border-[#e2efe4] flex items-center justify-center text-[18px] shrink-0" aria-hidden>
                      {t.icon}
                    </span>
                    <div>
                      <p className="text-[14.5px] font-bold text-[#0f1a2a] leading-snug">{t.title}</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[#5a6b7a]">{t.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ============ FAQ ============ */}
            <div className="mt-14 sm:mt-20">
              <p className="text-center text-[12px] sm:text-[13px] font-extrabold uppercase tracking-[0.18em] text-[#1d5c3a]/70">
                Dúvidas frequentes
              </p>
              <h2 className="mt-2.5 text-center text-[22px] sm:text-[30px] font-extrabold tracking-tight text-[#0f1a2a] leading-snug px-2">
                Perguntas e respostas
              </h2>
              <div className="mt-7 sm:mt-9">
                <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">Carregando...</div>}>
                  <AffiliatesFaq items={faq} />
                </Suspense>
              </div>
            </div>

            {/* ============ CTA FINAL ============ */}
            <div className="mt-14 sm:mt-20 rounded-[24px] bg-white/95 border border-[#e7ece8] shadow-[0_16px_48px_rgba(16,61,45,0.08)] px-6 py-9 sm:p-12 text-center">
              <p className="text-[22px] sm:text-[28px] font-extrabold tracking-tight text-[#0f1a2a] leading-snug">
                Sua rede já vale renda extra.<br className="hidden sm:block" /> Ative seu link agora.
              </p>
              <p className="mt-3 text-[14px] sm:text-[15px] leading-relaxed text-[#5a6b7a] max-w-[520px] mx-auto">
                Leva menos de 1 minuto: entre no painel e seu link de afiliado está pronto para compartilhar.
              </p>
              <a
                href={ctaHref}
                className="mt-7 inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#1d5c3a] hover:bg-[#154730] active:bg-[#103d2d] px-8 py-4 text-[15px] sm:text-[16px] font-bold text-white shadow-[0_10px_28px_rgba(29,92,58,0.28)] transition"
              >
                Aceitar e ativar meu link de afiliado <span aria-hidden>→</span>
              </a>
              {!user && (
                <p className="mt-3 text-[12.5px] text-[#8a9aa8] leading-relaxed">
                  Você vai entrar na sua conta primeiro e cair direto na área de afiliados.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

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
