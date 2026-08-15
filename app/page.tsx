import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SiteHome } from "@/components/site/SiteHome";
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
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  // ?preview=1 permite ao Super Admin visualizar a HOME pública mesmo logado
  // (ex.: "Visualizar HOME" em /admin/planos e no Editor da Home).
  const preview = searchParams?.preview === "1";
  const user = await getCurrentUser();
  if (user && !preview) {
    redirect("/painel");
  }

  const sections = await resolveHomeSections({ tenant: DEMO_TENANT });

  return (
    <SiteHome
      slug="index"
      sections={sections}
      extraNav={[
        { label: "Painel", href: "/login" },
      ]}
    />
  );
}
