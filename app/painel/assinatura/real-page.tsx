import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SectionTitle } from "@/components/dashboard/ui";
import { SubscriptionManager } from "@/components/dashboard/SubscriptionManager";
import { getActivationPrice, getMonthlyPrice } from "@/lib/billing";
import { getActiveOffer } from "@/lib/commercial";
import { getActiveGateway, resolveGateways } from "@/lib/gateway-config";
import { getAccountCreditSummary, type AccountCreditSummary } from "@/lib/affiliate-credit";
import { getAffiliateBalanceView, type AffiliateBalanceView } from "@/lib/affiliate";
import type { Plan } from "@/types";

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
  // PLANO DE VERDADE que governa preços/prazos exibidos: o plano da assinatura
  // do usuário quando existir; senão, a oferta ativa (a MESMA que o checkout
  // usará por padrão). Isso evita mostrar a mensalidade/período de OUTRO plano.
  const displayPlan: Plan | null =
    ((ctx.subscription as { plan?: Plan | null } | null)?.plan as Plan | null) ||
    ((ctx.plans as Plan[] | undefined)?.[0] ?? null) ||
    offer ||
    null;

  let activationPriceCents = displayPlan?.activation_price_cents ?? 0;
  let activationRegularPriceCents = displayPlan?.activation_regular_price_cents ?? 0;
  let monthlyPriceCents = displayPlan?.monthly_price_cents ?? 0;
  const allowCancel = displayPlan ? displayPlan.allow_cancel !== false : true;
  // trial_months = 0 é uma condição VÁLIDA ("sem meses inclusos") e NÃO pode
  // cair no fallback de 3 meses. Só usamos 3 quando o campo não é numérico.
  const rawTrialMonths = displayPlan?.trial_months;
  const trialMonths =
    displayPlan == null ? 3 : Number.isFinite(Number(rawTrialMonths)) ? Number(rawTrialMonths) : 3;
  const planName = displayPlan?.name ?? null;

  // Fallback ao Stripe SOMENTE quando não há plano em banco — nunca sobrescreve
  // o valor real do plano (0 é um preço válido, ex.: ativação inclusa).
  if (!displayPlan) {
    try {
      const [actPrice, monPrice] = await Promise.all([getActivationPrice(), getMonthlyPrice()]);
      activationPriceCents = actPrice.unit_amount || 0;
      monthlyPriceCents = monPrice.unit_amount || 0;
    } catch (e) {
      console.warn("Preços do Stripe não configurados/indisponíveis:", e);
    }
  }

  // Saldos do usuário (crédito do admin + programa de afiliados), mostrados
  // separadamente. Falhas nunca quebram a página (helpers devolvem zeros).
  let accountCredit: AccountCreditSummary = {
    grantedCents: 0,
    usedCents: 0,
    activationCents: 0,
    subscriptionCents: 0,
    totalCents: 0,
  };
  let affiliateBalance: AffiliateBalanceView = {
    availableCents: 0,
    pendingCents: 0,
    paidCents: 0,
    programActive: false,
  };
  const userId = (ctx.profile as { user_id?: string } | null)?.user_id || "";
  if (userId && !p.demoCtx) {
    const [ac, ab] = await Promise.all([
      getAccountCreditSummary(userId),
      getAffiliateBalanceView(userId),
    ]);
    accountCredit = ac;
    affiliateBalance = ab;
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
        planName={planName}
        accountCredit={accountCredit}
        affiliateBalance={affiliateBalance}
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
