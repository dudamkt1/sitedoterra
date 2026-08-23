import { getDashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CrmNav from "@/components/crm/CrmNav";
import CrmDashboard from "@/components/crm/CrmDashboard";
import { SectionTitle } from "@/components/dashboard/ui";
import { normalizeCrmSettings, getWhatsAppConfig } from "@/lib/crm";

export default async function CrmDashboardPage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;
  const admin = createAdminClient();
  const tenantId = ctx.tenant?.id;
  const settings = tenantId ? normalizeCrmSettings(tenantId, null) : null;
  const whatsapp = tenantId ? await getWhatsAppConfig(admin, tenantId) : null;

  return (
    <div>
      <CrmNav modules={settings?.modules || {}} activePrefix="/painel/crm" />
      <CrmDashboard initialStats={null} initialSettings={settings} initialWhatsApp={whatsapp} />
    </div>
  );
}
