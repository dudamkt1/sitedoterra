import { getCurrentUser } from "@/lib/auth";
import { SiteHome } from "@/components/site/SiteHome";
import { LoggedInNotice } from "@/components/site/LoggedInNotice";
import { DEFAULT_SITE_DATA } from "@/lib/site-data";
import { resolveHomeSections } from "@/lib/home";
import { getPublicTenantBySlug } from "@/lib/tenant";
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
 */
export default async function HomePage() {
  const user = await getCurrentUser();

  const homeSlug = process.env.HOME_TENANT_SLUG || "usuarioteste";
  const tenant = (await getPublicTenantBySlug(homeSlug)) || DEMO_TENANT;

  const sections = await resolveHomeSections({ tenant, tenantDataOverridesGlobal: true });
  const siteData = (tenant.site_data || {}) as Record<string, unknown>;

  return (
    <>
      {user && <LoggedInNotice email={user.email} />}
      <SiteHome
        slug={tenant.slug}
        sections={sections}
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
    </>
  );
}
