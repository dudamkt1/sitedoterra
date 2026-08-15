import { getDashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { SubscriptionManager } from "@/components/dashboard/SubscriptionManager";
import { getActivationPrice, getMonthlyPrice } from "@/lib/billing";
import { getActiveOffer } from "@/lib/commercial";

export const dynamic = "force-dynamic";

export default async function AssinaturaPage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;

  const admin = (await import("@/lib/supabase/admin")).createAdminClient();
  const tenantId = ctx.tenant?.id;
  const [{ data: billingHistory }, { data: payments }, { data: activation }] = await Promise.all([
    tenantId
      ? admin.from("billing_history").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    tenantId
      ? admin.from("payments").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    tenantId
      ? admin.from("payments").select("*").eq("tenant_id", tenantId).eq("type", "activation").eq("status", "succeeded").order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Valores exibidos: FONTE = configuração comercial do Super Admin (tabela plans).
  // Fallback = preços do Stripe quando a oferta não estiver configurada.
  const offer = await getActiveOffer();
  let activationPriceCents = offer?.activation_price_cents || 0;
  let activationRegularPriceCents = offer?.activation_regular_price_cents || 0;
  let monthlyPriceCents = offer?.monthly_price_cents || 0;
  let allowCancel = offer ? offer.allow_cancel !== false : true;
  const trialMonths = offer?.trial_months || 3;
  if (!activationPriceCents || !monthlyPriceCents) {
    try {
      const [actPrice, monPrice] = await Promise.all([getActivationPrice(), getMonthlyPrice()]);
      if (!activationPriceCents) activationPriceCents = actPrice.unit_amount || 0;
      if (!monthlyPriceCents) monthlyPriceCents = monPrice.unit_amount || 0;
    } catch (e) {
      console.warn("Preços do Stripe não configurados/indisponíveis:", e);
    }
  }

  return (
    <div>
      <SectionTitle sub="Gerencie a ativação do site, sua mensalidade e o histórico financeiro.">
        Minha Assinatura
      </SectionTitle>
      <SubscriptionManager
        subscription={ctx.subscription as any}
        plans={ctx.plans as any}
        billingHistory={billingHistory as any[]}
        payments={payments as any[]}
        activation={activation as any}
        activationPriceCents={activationPriceCents}
        activationRegularPriceCents={activationRegularPriceCents}
        monthlyPriceCents={monthlyPriceCents}
        allowCancel={allowCancel}
        trialMonths={trialMonths}
        billingEnabled={ctx.tenant?.monthly_billing_enabled !== false}
      />
    </div>
  );
}
