import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SectionTitle } from "@/components/dashboard/ui";
import { SubscriptionManager } from "@/components/dashboard/SubscriptionManager";
import { getActivationPrice, getMonthlyPrice } from "@/lib/billing";
import { getActiveOffer } from "@/lib/commercial";
import { getActiveGateway } from "@/lib/gateway-config";

export const dynamic = "force-dynamic";

// Histórico fictício da demonstração (mesma forma dos dados reais).
const DEMO_ROWS = [
  {
    id: "bh_1",
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    type: "activation",
    amount_cents: 29700,
    status: "succeeded",
    stripe_charge_id: null,
    stripe_payment_intent_id: null,
    mercadopago_payment_id: null,
  },
  {
    id: "bh_2",
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    type: "subscription",
    amount_cents: 4700,
    status: "succeeded",
    stripe_charge_id: null,
    stripe_payment_intent_id: null,
    mercadopago_payment_id: null,
  },
];

export default async function AssinaturaPage(p: { demoCtx?: DashboardContext }) {
  const ctx = p.demoCtx ?? (await getDashboardContext());
  if (!ctx?.profile) return null;

  const tenantId = ctx.tenant?.id;

  let billingHistory: any[] = DEMO_ROWS;
  let payments: any[] = DEMO_ROWS;
  let activation: any = null;

  if (tenantId && !p.demoCtx) {
    const admin = createAdminClient();
    const [hist, pays, act] = await Promise.all([
      admin.from("billing_history").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
      admin.from("payments").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
      admin.from("payments").select("*").eq("tenant_id", tenantId).eq("type", "activation").eq("status", "succeeded").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    billingHistory = (hist.data as any[]) || [];
    payments = (pays.data as any[]) || [];
    activation = act.data as any;
  }

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
        activeGateway={await getActiveGateway()}
      />
    </div>
  );
}
