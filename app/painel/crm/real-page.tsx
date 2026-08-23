import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CrmNav from "@/components/crm/CrmNav";
import CrmDashboard from "@/components/crm/CrmDashboard";
import { getCrmSettings, normalizeCrmSettings } from "@/lib/crm";
import { getWhatsAppConfig } from "@/lib/crm";

export default async function CrmDashboardPage(p: { demoCtx?: DashboardContext }) {
  const ctx = p.demoCtx ?? (await getDashboardContext());
  if (!ctx?.profile) return null;
  const tenantId = ctx.tenant?.id;
  const admin = p.demoCtx ? null : tenantId ? createAdminClient() : null;
  const settings = tenantId
    ? admin
      ? await getCrmSettings(admin, tenantId)
      : normalizeCrmSettings(tenantId, null)
    : null;
  const whatsapp = tenantId && admin ? await getWhatsAppConfig(admin, tenantId) : null;

  return (
    <div>
      <CrmNav modules={settings?.modules || {}} activePrefix="/painel/crm" />
      <CrmDashboard initialStats={null} initialSettings={settings} initialWhatsApp={whatsapp} />
    </div>
  );
}
