import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SectionTitle } from "@/components/dashboard/ui";
import { SubscriptionManager } from "@/components/dashboard/SubscriptionManager";
import { getActivationPrice, getMonthlyPrice } from "@/lib/billing";
import { getActiveOffer } from "@/lib/commercial";
import { getActiveGateway, resolveGateways } from "@/lib/gateway-config";

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

  let refundPending = false;
  let latestActivationStatus: string | null = null;

  if (tenantId && !p.demoCtx) {
    const admin = createAdminClient();
    const [hist, pays, act, lastPay, latestAct] = await Promise.all([
      admin.from("billing_history").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
      admin.from("payments").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
      admin.from("payments").select("*").eq("tenant_id", tenantId).eq("type", "activation").eq("status", "succeeded").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("payments").select("status").eq("tenant_id", tenantId).in("type", ["activation", "subscription"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("payments").select("status").eq("tenant_id", tenantId).eq("type", "activation").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    billingHistory = (hist.data as any[]) || [];
    payments = (pays.data as any[]) || [];
    activation = act.data as any;
    latestActivationStatus = ((latestAct.data as { status?: string } | null)?.status) || null;
    refundPending = latestActivationStatus === "refund_pending";

    // Cura: ativação PAGA como última atualização mas assinatura ausente/
    // cancelada (ex.: falha antiga) → recria assinatura ativa em trial e
    // religa o site, para o STATUS exibir ATIVO em vez de "Cancelada".
    // NUNCA cura durante/depois de reembolso (pedido respeitado; após
    // reembolsado o site permanece desativado até novo pagamento).
    const lastSucceeded = (lastPay.data as { status?: string } | null)?.status === "succeeded";
    const refundFlow = latestActivationStatus === "refund_pending" || latestActivationStatus === "refunded";
    const subStatus = (ctx.subscription as { status?: string } | null)?.status;
    const siteActiveNow = ctx.tenant?.site_status === "active";
    if (!refundFlow && lastSucceeded && (!ctx.subscription || (subStatus !== "active" && subStatus !== "trialing") || !siteActiveNow)) {
      try {
        const { ensureTenantActivated } = await import("@/lib/mp-payment-processor");
        const healed = await ensureTenantActivated(tenantId);
        if (healed) {
          const [tFresh, sFresh] = await Promise.all([
            admin.from("tenants").select("site_status").eq("id", tenantId).maybeSingle(),
            admin.from("subscriptions").select("*, plan:plan_id(*)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          ]);
          if ((tFresh.data as { site_status?: string } | null)?.site_status === "active" && ctx.tenant) {
            ctx.tenant.site_status = "active";
          }
          if (sFresh.data) {
            (ctx as { subscription?: unknown }).subscription = sFresh.data;
          }
        }
      } catch {}
    }
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

  const mp = await gatewayConditions();

  // Garantia de 7 dias: botão "Quero Cancelar" visível SOMENTE até 7 dias
  // após a aprovação da ativação (janela validada de novo no backend).
  let guaranteeUntil: string | null = null;
  try {
    const paidAt = (activation as { paid_at?: string; created_at?: string } | null)?.paid_at ||
      (activation as { created_at?: string } | null)?.created_at;
    if (paidAt) {
      const until = new Date(new Date(paidAt).getTime() + 7 * 86_400_000);
      if (Number.isFinite(until.getTime()) && Date.now() <= until.getTime()) {
        guaranteeUntil = until.toISOString();
      }
    }
  } catch {}

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
        siteActive={ctx.tenant?.site_status === "active"}
        pixDiscountPercent={mp.pixDiscountPercent}
        installments={mp.installments}
        installmentsWithoutInterest={mp.installmentsWithoutInterest}
        guaranteeUntil={refundPending ? null : guaranteeUntil}
        refundPending={refundPending}
        latestActivationStatus={latestActivationStatus}
      />
    </div>
  );
}

async function gatewayConditions() {
  try {
    const g = await resolveGateways();
    return {
      pixDiscountPercent: g.mercadopago.pixDiscountPercent || 0,
      installments: g.mercadopago.installments || 0,
      installmentsWithoutInterest: g.mercadopago.installmentsWithoutInterest !== false,
    };
  } catch {
    return { pixDiscountPercent: 0, installments: 0, installmentsWithoutInterest: true };
  }
}
