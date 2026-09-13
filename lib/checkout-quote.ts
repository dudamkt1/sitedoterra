import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOffer, getPlanById } from "@/lib/commercial";
import { activateTenant, addMonths } from "@/lib/billing";
import {
  calcAffiliateCredit,
  getAffiliateCreditBalance,
  reserveAffiliateCredit,
  applyAffiliateCredit,
  type ChargeKind,
  type CreditBreakdown,
  type ReservedCredit,
} from "@/lib/affiliate-credit";
import type { Plan } from "@/types";

/**
 * Cotação de checkout com crédito de afiliado — FONTE DE VERDADE do valor.
 *
 * O frontend envia apenas intenções (`type`, `payMethod`, `useAffiliateCredit`);
 * todos os valores (plano, desconto PIX, saldo, reserva) são resolvidos aqui,
 * no backend. O valor `totalCents` retornado é FIXO até a conclusão: ele é
 * gravado na preferência/pagamento do gateway e na reserva de crédito.
 */

export interface CheckoutQuote extends ReservedCredit {
  kind: ChargeKind;
  plan: Plan;
  /** Método efetivo ("pix" | "card"). */
  payMethod: "pix" | "card";
  /** Assinatura local (só quando kind = subscription). */
  subscriptionId: string | null;
}

export class QuoteError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Monta a cotação: resolve plano → aplica desconto PIX do método →
 * aplica crédito de afiliado (com reserva atômica) → total final.
 */
export async function buildCheckoutQuote(input: {
  userId: string;
  tenantId: string;
  planId?: string;
  kind: ChargeKind;
  payMethod: "pix" | "card";
  useAffiliateCredit: boolean;
  pixDiscountPercent: number;
}): Promise<CheckoutQuote> {
  const admin = createAdminClient();

  let plan: Plan | null = null;
  if (input.planId) {
    const { data: p } = await admin
      .from("plans")
      .select("*")
      .eq("id", input.planId)
      .eq("is_active", true)
      .neq("status", "inactive")
      .maybeSingle();
    plan = (p as Plan | null) || null;
  }
  if (!plan) plan = await getActiveOffer();
  if (!plan) throw new QuoteError("Nenhuma oferta ativa disponível");

  let subscriptionId: string | null = null;
  let fullCents: number;
  if (input.kind === "subscription") {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) throw new QuoteError("Nenhuma assinatura encontrada para pagar a mensalidade");
    subscriptionId = (sub as { id: string }).id;
    fullCents = plan.monthly_price_cents;
    if (!Number.isFinite(fullCents) || fullCents < 0) {
      throw new QuoteError("Plano sem mensalidade configurada");
    }
  } else {
    fullCents = plan.activation_price_cents;
  }

  const pixDiscount = Math.min(50, Math.max(0, Number(input.pixDiscountPercent) || 0));
  const methodBaseCents =
    input.payMethod === "pix" && pixDiscount > 0
      ? Math.round((fullCents * (100 - pixDiscount)) / 100)
      : fullCents;

  let breakdown: CreditBreakdown = {
    originalCents: methodBaseCents,
    creditCents: 0,
    totalCents: methodBaseCents,
  };
  let usageId: string | null = null;

  if (input.useAffiliateCredit && methodBaseCents > 0) {
    const { cents: balanceCents } = await getAffiliateCreditBalance(input.userId);
    if (balanceCents > 0) {
      const calc = calcAffiliateCredit(methodBaseCents, balanceCents);
      if (calc.creditCents > 0) {
        const reserved = await reserveAffiliateCredit({
          userId: input.userId,
          amountCents: calc.creditCents,
          tenantId: input.tenantId,
          kind: input.kind,
          metadata: { plan_id: plan.id, original_cents: calc.originalCents },
        });
        if (reserved) {
          usageId = reserved;
          breakdown = calc;
        }
        // Reserva indisponível (saldo mudou/infra ausente): segue SEM
        // crédito — o pagamento nunca é bloqueado por isso.
      }
    }
  }

  return {
    kind: input.kind,
    plan,
    payMethod: input.payMethod,
    subscriptionId,
    originalCents: breakdown.originalCents,
    creditCents: breakdown.creditCents,
    totalCents: breakdown.totalCents,
    usageId,
  };
}

/**
 * Cumprimento SINCRONO de pagamento 100% coberto por crédito (total R$ 0,00):
 * sem gateway, sem cobrança — registra pagamento zerado, confirma o crédito
 * e ativa/estende a assinatura. Chamado somente quando totalCents === 0 com
 * reserva válida (usageId presente).
 */
export async function fulfillZeroChargePayment(input: {
  userId: string;
  tenantId: string;
  quote: CheckoutQuote;
}): Promise<{ paymentId: string }> {
  const { tenantId, quote } = input;
  if (!quote.usageId || quote.totalCents !== 0) {
    throw new QuoteError("Pagamento zerado inválido");
  }
  const admin = createAdminClient();

  const creditMeta = {
    gateway: "affiliate_credit",
    type: quote.kind,
    plan_id: quote.plan.id,
    credit_usage_id: quote.usageId,
    credit_applied_cents: quote.creditCents,
    original_amount_cents: quote.originalCents,
  };

  // 1) Pagamento zerado confirmado.
  const { data: payment, error: payErr } = await admin
    .from("payments")
    .insert({
      tenant_id: tenantId,
      subscription_id: quote.subscriptionId,
      type: quote.kind,
      amount_cents: 0,
      currency: "brl",
      status: "succeeded",
      paid_at: new Date().toISOString(),
      metadata: creditMeta,
    })
    .select("id")
    .single();
  if (payErr || !payment) throw new QuoteError("Não foi possível registrar o pagamento");

  // 2) Confirma o crédito (vinculado a este pagamento).
  const applied = await applyAffiliateCredit(quote.usageId, payment.id);
  if (!applied) {
    // Reserva perdida entre a cotação e aqui: desfaz o pagamento zerado para
    // não ativar nada sem o crédito correspondente.
    await admin.from("payments").delete().eq("id", payment.id);
    throw new QuoteError("Crédito indisponível — tente novamente");
  }

  await admin.from("billing_history").insert({
    tenant_id: tenantId,
    subscription_id: quote.subscriptionId,
    plan_id: quote.plan.id,
    type: quote.kind,
    amount_cents: 0,
    currency: "brl",
    status: "succeeded",
  });

  if (quote.kind === "activation") {
    await fulfillZeroChargeActivation(admin, tenantId, input.userId, quote);
  } else {
    await extendSubscriptionPeriod(admin, tenantId, quote.subscriptionId!);
  }

  await activateTenant(tenantId, input.userId);

  await admin.from("audit_logs").insert({
    actor_id: input.userId,
    actor_role: "user",
    action:
      quote.kind === "activation" ? "user.site_activated_payment" : "user.site_reactivated_payment",
    entity_type: "profile",
    entity_id: input.userId,
    metadata: { tenant_id: tenantId, via: "affiliate_credit", ...creditMeta },
  });

  return { paymentId: payment.id };
}

async function fulfillZeroChargeActivation(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  userId: string,
  quote: CheckoutQuote
) {
  const { data: existingActive } = await admin
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing"])
    .maybeSingle();
  if (existingActive) return;

  const { data: tenantRow } = await admin
    .from("tenants")
    .select("monthly_billing_enabled")
    .eq("id", tenantId)
    .maybeSingle();
  const billingEnabled = tenantRow?.monthly_billing_enabled !== false;

  const trialMonths = Math.max(1, quote.plan.trial_months || 3);
  const trialEnd = addMonths(new Date(), trialMonths);

  // Assinatura local SEM gateway recorrente (não há meio de cobrança
  // automática — a mensalidade será paga manualmente quando vencer).
  await admin.from("subscriptions").insert({
    tenant_id: tenantId,
    plan_id: quote.plan.id,
    gateway: "affiliate_credit",
    status: "active",
    current_period_start: new Date().toISOString(),
    current_period_end: trialEnd.toISOString(),
    next_billing_at: billingEnabled ? trialEnd.toISOString() : null,
    trial_end: trialEnd.toISOString(),
    activated_at: new Date().toISOString(),
    snapshot: {
      gateway: "affiliate_credit",
      plan_id: quote.plan.id,
      currency: "brl",
      activation_amount_cents: 0,
      activation_original_cents: quote.originalCents,
      credit_applied_cents: quote.creditCents,
      monthly_amount_cents: quote.plan.monthly_price_cents,
      trial_months: trialMonths,
      trial_period_days: trialMonths * 30,
    },
  });

  if (!billingEnabled) {
    await admin
      .from("tenants")
      .update({ site_status: "active", suspended_at: null, activated_at: new Date().toISOString() })
      .eq("id", tenantId);
    await admin
      .from("profiles")
      .update({ status: "active", activated_at: new Date().toISOString() })
      .eq("user_id", userId);
  }
}

/** Estende a assinatura em +1 mês a partir do fim do período vigente. */
export async function extendSubscriptionPeriod(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  subscriptionId: string
) {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("current_period_end, next_billing_at")
    .eq("id", subscriptionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!sub) throw new QuoteError("Assinatura não encontrada");

  const anchorStr =
    (sub as { current_period_end?: string | null; next_billing_at?: string | null })
      .current_period_end ||
    (sub as { next_billing_at?: string | null }).next_billing_at ||
    null;
  const anchor = anchorStr ? new Date(anchorStr) : new Date();
  const base = Number.isNaN(anchor.getTime()) || anchor.getTime() < Date.now() ? new Date() : anchor;
  const nextEnd = addMonths(base, 1);

  await admin
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: nextEnd.toISOString(),
      next_billing_at: nextEnd.toISOString(),
    })
    .eq("id", subscriptionId);
}
