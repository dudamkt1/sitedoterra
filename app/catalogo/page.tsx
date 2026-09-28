import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOfficialHomeTenant } from "@/lib/site-official";
import { resolveHomeSections } from "@/lib/home";
import { resolveModelLogo } from "@/lib/site-data";
import {
  MAIN_CATALOG_KEY,
  buildWhatsAppLink,
  normalizeMainCatalog,
} from "@/lib/catalog-main";
import MainCatalogClient from "@/components/catalog/MainCatalogClient";

export const dynamic = "force-dynamic";

/**
 * Catálogo do DOMÍNIO PRINCIPAL — https://site.topconsultores.com.br/catalogo
 *
 * Rota FIXA (sem slug), diferente de `/catalogo/[slug]` que é o catálogo
 * público de cada tenant. O conteúdo vem de `platform_config.main_catalog`,
 * montado pelo Super Admin em /admin/catalogo — por isso não interfere no
 * catálogo dos usuários nem no CRM.
 */
export default async function MainCatalogPage({
  searchParams,
}: {
  searchParams?: { msg?: string };
}) {
  const admin = createAdminClient();

  let catalog = normalizeMainCatalog(null);
  try {
    const { data } = await admin
      .from("platform_config")
      .select("value")
      .eq("key", MAIN_CATALOG_KEY)
      .maybeSingle();
    if (data?.value) catalog = normalizeMainCatalog(data.value);
  } catch {
    // sem config salva ainda → página com estado vazio
  }

  // Rota some da net enquanto o Super Admin não publica.
  if (!catalog.enabled) notFound();

  // Identidade do site oficial (mesmo tenant da Home `/`).
  const tenant = await getOfficialHomeTenant();
  const siteData = (tenant.site_data || {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => {
    const s = typeof v === "string" ? v.trim() : "";
    return s || undefined;
  };

  // LOGOTIPO SINCRONIZADO COM A HOME DO DOMÍNIO PRINCIPAL (`/` → SiteHome):
  // mesma fonte e mesma prioridade — seção "Cabeçalho/Menu" do
  // /admin/editor-home primeiro, `site_data` só como fallback, via
  // `resolveModelLogo` (exatamente como app/page.tsx).
  const sections = await resolveHomeSections({
    tenant,
    tenantDataOverridesGlobal: true,
    ignoreTenantOverrides: true,
  });
  const headerContent = ((sections.find((s) => s.type === "header")?.content ||
    {}) as Record<string, unknown>) || {};
  const modelLogo = resolveModelLogo(
    headerContent,
    siteData,
    tenant.profile_name || tenant.site_name || undefined
  );

  const profileName =
    tenant.profile_name || str(siteData.fullName) || tenant.site_name || "TopConsultores";

  const whatsappSource =
    catalog.whatsapp || str(siteData.whatsapp) || str(siteData._contactWhatsapp) || "";
  const whatsappLink = buildWhatsAppLink(
    whatsappSource,
    "Olá! Vi o catálogo e gostaria de mais informações."
  );

  const products = catalog.products.filter((p) => p.active);
  const initialMessage = searchParams?.msg ? decodeURIComponent(String(searchParams.msg)) : null;

  return (
    <MainCatalogClient
      title={catalog.title}
      subtitle={catalog.subtitle}
      profileName={profileName}
      logo={{ mode: modelLogo.mode, url: modelLogo.url, text: modelLogo.text }}
      products={products}
      whatsappLink={whatsappLink}
      initialMessage={initialMessage}
    />
  );
}
