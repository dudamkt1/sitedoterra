import type { ResolvedHomeSection } from "@/types";
import { Header } from "@/components/site/sections/Header";
import { Hero } from "@/components/site/sections/Hero";
import { Trustbar } from "@/components/site/sections/Trustbar";
import { About } from "@/components/site/sections/About";
import { Testimonials } from "@/components/site/sections/Testimonials";
import { Story } from "@/components/site/sections/Story";
import { Video } from "@/components/site/sections/Video";
import { Booking } from "@/components/site/sections/Booking";
import { Tips } from "@/components/site/sections/Tips";
import { Products } from "@/components/site/sections/Products";
import { Faq } from "@/components/site/sections/Faq";
import { Pricing } from "@/components/site/sections/Pricing";
import { Footer } from "@/components/site/sections/Footer";
import { SiteEffects } from "@/components/site/sections/SiteEffects";

export interface SiteContact {
  whatsapp?: string;
  email?: string;
  instagram?: string;
  profileName?: string;
}

export interface SiteLogo {
  mode?: "image" | "text";
  url?: string;
  lightUrl?: string;
  text?: string;
}

interface SiteHomeProps {
  slug: string;
  sections: ResolvedHomeSection[];
  contact?: SiteContact;
  logo?: SiteLogo;
  extraNav?: { label: string; href: string; className?: string }[];
}

/**
 * Orquestrador da HOME pública.
 * Recebe a lista de seções JÁ resolvidas (global → usuário → público) e
 * renderiza cada uma como componente independente, na ordem correta.
 * Seções desativadas são simplesmente ignoradas.
 */
export function SiteHome({ slug, sections, contact, logo, extraNav = [] }: SiteHomeProps) {
  const visible = sections.filter((s) => s.enabled);

  const headerSection = visible.find((s) => s.type === "header");
  const headerContent = (headerSection?.content || {}) as Record<string, unknown>;
  const logoText = logo?.text || (headerContent.logoText as string) || (headerSection?.label as string) || "Logo";
  const logoUrl =
    logo?.mode === "text"
      ? undefined
      : logo?.url || (headerContent.logoUrl as string) || undefined;

  const navItems = visible
    .filter((s) => s.settings?.showInNav !== false && s.type !== "header" && s.type !== "footer")
    .map((s) => ({ label: (s.navLabel || s.label) as string, href: `#${s.anchor}` }));

  const footerSection = visible.find((s) => s.type === "footer");
  const footerContent = (footerSection?.content || {}) as Record<string, unknown>;

  const whatsapp = contact?.whatsapp || (footerContent._contactWhatsapp as string) || undefined;
  const email = contact?.email || (footerContent._contactEmail as string) || undefined;
  const instagram = contact?.instagram || (footerContent._contactInstagram as string) || undefined;
  const profileName = contact?.profileName || (footerContent._profileName as string) || (headerSection?.content.logoText as string) || undefined;

  return (
    <div id="tenant-site" data-slug={slug}>
      <SiteEffects />
      <Header logoText={logoText} logoUrl={logoUrl} logoLightUrl={logo?.lightUrl} navItems={navItems} extraNav={extraNav} />

      {visible.map((s) => {
        switch (s.type) {
          case "header":
            return null;
          case "hero":
            return <Hero key={s.id} content={s.content as never} />;
          case "trustbar":
            return <Trustbar key={s.id} content={s.content as never} />;
          case "about":
            return <About key={s.id} content={s.content as never} contactWhatsapp={whatsapp} profileName={profileName} slug={slug} />;
          case "testimonials":
            return <Testimonials key={s.id} content={s.content as never} />;
          case "story":
            return <Story key={s.id} content={s.content as never} />;
          case "video":
            return <Video key={s.id} content={s.content as never} />;
          case "booking":
            return <Booking key={s.id} content={s.content as never} contactWhatsapp={whatsapp} profileName={profileName} />;
          case "tips":
            return <Tips key={s.id} content={s.content as never} />;
          case "products":
            return <Products key={s.id} content={s.content as never} contactWhatsapp={whatsapp} />;
          case "faq":
            return <Faq key={s.id} content={s.content as never} />;
          case "pricing":
            return <Pricing key={s.id} content={s.content as never} />;
          case "footer":
            return null;
          default:
            return null;
        }
      })}

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
