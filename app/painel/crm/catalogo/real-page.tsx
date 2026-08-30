import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import CrmNav from "@/components/crm/CrmNav";
import CrmCatalogClient from "@/components/crm/CrmCatalogClient";

export default async function CrmCatalogoPage(p: { demoCtx?: DashboardContext }) {
  const ctx = p.demoCtx ?? (await getDashboardContext());
  if (!ctx?.profile) return null;
  const tenantSlug = ctx.tenant?.slug ?? null;

  return (
    <div>
      <CrmNav modules={{}} activePrefix="/painel/crm/catalogo" />
      <CrmCatalogClient tenantSlug={tenantSlug} />
    </div>
  );
}
