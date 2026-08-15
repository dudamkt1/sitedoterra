import { getCurrentUser } from "@/lib/auth";
import { SiteHome } from "@/components/site/SiteHome";
import { LoggedInNotice } from "@/components/site/LoggedInNotice";
import { DEFAULT_SITE_DATA } from "@/lib/site-data";
import { resolveHomeSections } from "@/lib/home";
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
 * Usa a mesma arquitetura modular multi-tenant: as seções são resolvidas a
 * partir da configuração GLOBAL (Super Admin) com o conteúdo padrão, e o
 * Super Admin edita tudo em /admin/editor-home.
 *
 * Usuários logados NÃO são forçados ao painel: veem a página normalmente e
 * apenas um aviso discreto de que estão logados (LoggedInNotice).
 */
export default async function HomePage() {
  const user = await getCurrentUser();

  const sections = await resolveHomeSections({ tenant: DEMO_TENANT });

  return (
    <>
      {user && <LoggedInNotice email={user.email} />}
      <SiteHome
        slug="index"
        sections={sections}
        extraNav={[{ label: "Painel", href: user ? "/painel" : "/login" }]}
      />
    </>
  );
}
