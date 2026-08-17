import { getDashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CrmNav from "@/components/crm/CrmNav";
import CrmFinancial from "@/components/crm/CrmFinancial";
import { getCrmSettings } from "@/lib/crm";

export default async function CrmFinanceiroPage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;
  const admin = createAdminClient();
  const settings = ctx.tenant ? await getCrmSettings(admin, ctx.tenant.id) : null;

  return (
    <div>
      <CrmNav modules={settings?.modules || {}} activePrefix="/painel/crm/financeiro" />
      <CrmFinancial categories={{ income: settings?.financial_categories?.income || [], expense: settings?.financial_categories?.expense || [] }} />
    </div>
  );
}