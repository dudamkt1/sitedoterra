import { getDashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CrmNav from "@/components/crm/CrmNav";
import CrmWhatsApp from "@/components/crm/CrmWhatsApp";
import { getCrmSettings } from "@/lib/crm";

export default async function CrmWhatsAppPage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;
  const admin = createAdminClient();
  const settings = ctx.tenant ? await getCrmSettings(admin, ctx.tenant.id) : null;

  return (
    <div>
      <CrmNav modules={settings?.modules || {}} activePrefix="/painel/crm/whatsapp" />
      <CrmWhatsApp />
    </div>
  );
}
