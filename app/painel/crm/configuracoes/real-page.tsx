import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CrmNav from "@/components/crm/CrmNav";
import CrmSettings from "@/components/crm/CrmSettings";
import { getCrmSettings, normalizeCrmSettings } from "@/lib/crm";

export default async function CrmConfiguracoesPage(p: { demoCtx?: DashboardContext }) {
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
      <CrmNav modules={settings?.modules || {}} activePrefix="/painel/crm/configuracoes" />
      <CrmSettings initialSettings={settings} />
    </div>
  );
}
