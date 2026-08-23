import { getDashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CrmNav from "@/components/crm/CrmNav";
import CrmCharges from "@/components/crm/CrmCharges";
import { getCrmSettings } from "@/lib/crm";

export default async function CrmCobrancasPage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;
  const admin = createAdminClient();
  const settings = ctx.tenant ? await getCrmSettings(admin, ctx.tenant.id) : null;

  return (
    <div>
      <CrmNav modules={settings?.modules || {}} activePrefix="/painel/crm/cobrancas" />
      <CrmCharges />
    </div>
  );
}
