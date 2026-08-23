import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CrmNav from "@/components/crm/CrmNav";
import CrmClients from "@/components/crm/CrmClients";
import { getCrmSettings, normalizeCrmSettings } from "@/lib/crm";

export default async function CrmClientesPage(p: { demoCtx?: DashboardContext }) {
  const ctx = p.demoCtx ?? (await getDashboardContext());
  if (!ctx?.profile) return null;
  const admin = p.demoCtx ? null : createAdminClient();
  const settings = ctx.tenant
    ? admin
      ? await getCrmSettings(admin, ctx.tenant.id)
      : normalizeCrmSettings(ctx.tenant.id, null)
    : null;

  return (
    <div>
      <CrmNav modules={settings?.modules || {}} activePrefix="/painel/crm/clientes" />
      <CrmClients initialSettings={settings} />
    </div>
  );
}
