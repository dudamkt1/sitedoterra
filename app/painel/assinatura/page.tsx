import { getDashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { SubscriptionManager } from "@/components/dashboard/SubscriptionManager";

export default async function AssinaturaPage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;

  const admin = (await import("@/lib/supabase/admin")).createAdminClient();
  const tenantId = ctx.tenant?.id;
  const [{ data: billingHistory }, { data: payments }] = await Promise.all([
    tenantId
      ? admin.from("billing_history").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    tenantId
      ? admin.from("payments").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div>
      <SectionTitle sub="Gerencie seu plano, forma de pagamento e histórico financeiro.">
        Minha Assinatura
      </SectionTitle>
      <SubscriptionManager
        subscription={ctx.subscription as any}
        plans={ctx.plans as any}
        billingHistory={billingHistory as any[]}
        payments={payments as any[]}
      />
    </div>
  );
}
