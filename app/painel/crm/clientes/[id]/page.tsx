import { getDashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CrmNav from "@/components/crm/CrmNav";
import CrmClientDetail from "@/components/crm/CrmClientDetail";
import { getCrmSettings } from "@/lib/crm";

export default async function CrmClientDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;
  const admin = createAdminClient();
  const settings = ctx.tenant ? await getCrmSettings(admin, ctx.tenant.id) : null;

  return (
    <div>
      <CrmNav modules={settings?.modules || {}} activePrefix="/painel/crm/clientes" />
      <CrmClientDetail clientId={params.id} />
    </div>
  );
}