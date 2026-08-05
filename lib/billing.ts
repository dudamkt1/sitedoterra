import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan, Subscription } from "@/types";

export interface BillingUser {
  userId: string;
  tenantId: string;
  email: string;
  name: string | null;
}

/** Busca ou cria um Customer no Stripe para o usuário. */
export async function getOrCreateCustomer(metadata: BillingUser): Promise<Stripe.Customer> {
  const admin = createAdminClient();
  const stripe = getStripe();

  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", metadata.tenantId)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (existingSub?.stripe_customer_id) {
    return (await stripe.customers.retrieve(existingSub.stripe_customer_id)) as Stripe.Customer;
  }

  const customer = await stripe.customers.create({
    email: metadata.email,
    name: metadata.name || undefined,
    metadata: { tenant_id: metadata.tenantId, user_id: metadata.userId },
  });

  return customer;
}

/**
 * Preço único de ativação (one-time) por plano. Usa idempotency key para
 * não criar preços duplicados no Stripe.
 */
export async function getOrCreateActivationPrice(plan: Plan): Promise<Stripe.Price> {
  const stripe = getStripe();
  const amount = plan.activation_price_cents;

  const existing = await stripe.prices.list({
    lookup_keys: [`activation-${plan.code}`],
    limit: 1,
  });
  if (existing.data.length > 0) return existing.data[0];

  const product = plan.stripe_product_id
    ? plan.stripe_product_id
    : (
        await stripe.products.create({ name: `Ativação — ${plan.name}`, metadata: { plan_code: plan.code } })
      ).id;

  return stripe.prices.create(
    {
      product,
      unit_amount: amount,
      currency: "brl",
      lookup_key: `activation-${plan.code}`,
      metadata: { plan_code: plan.code, type: "activation" },
    },
    { idempotencyKey: `price-activation-${plan.code}` }
  );
}

/**
 * Cria a assinatura recorrente com billing_cycle_anchor em +30 dias
 * (primeira mensalidade cobrada 1 mês após a ativação).
 */
export async function createRecurringSubscription(
  customerId: string,
  plan: Plan,
  metadata: BillingUser
): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  // Garante preço recorrente no Stripe para o plano
  const priceId =
    plan.stripe_price_id ||
    (
      await stripe.prices.list({ lookup_keys: [`${plan.code}-recurring`], limit: 1 })
    ).data[0]?.id;

  const resolvedPriceId =
    priceId ||
    (
      await stripe.prices.create(
        {
          product: plan.stripe_product_id || (await stripe.products.create({ name: plan.name })).id,
          unit_amount: plan.monthly_price_cents,
          currency: "brl",
          recurring: { interval: plan.billing_interval === "year" ? "year" : "month", interval_count: 1 },
          lookup_key: `${plan.code}-recurring`,
          metadata: { plan_code: plan.code },
        },
        { idempotencyKey: `price-recurring-${plan.code}` }
      )
    ).id;

  const anchor = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: resolvedPriceId }],
    billing_cycle_anchor: anchor,
    proration_behavior: "none",
    payment_behavior: "allow_incomplete",
    metadata: { tenant_id: metadata.tenantId, user_id: metadata.userId, plan_id: plan.id },
  });
}

/** Upsert de assinatura local a partir de dados do Stripe (fonte de verdade = webhook). */
export async function upsertSubscriptionFromStripe(sub: Stripe.Subscription): Promise<Subscription | null> {
  const admin = createAdminClient();
  const tenantId = sub.metadata?.tenant_id as string | undefined;
  const planId = sub.metadata?.plan_id as string | undefined;
  if (!tenantId) return null;

  const status = mapStripeStatus(sub.status);

  const payload = {
    tenant_id: tenantId,
    plan_id: planId || null,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    stripe_price_id: (sub.items.data[0]?.price?.id as string) || null,
    status,
    current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    next_billing_at: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    activated_at: sub.status === "active" ? new Date().toISOString() : undefined,
    canceled_at: sub.status === "canceled" ? new Date().toISOString() : undefined,
  };

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  if (existing) {
    const { data } = await admin
      .from("subscriptions")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    return (data as Subscription) || null;
  }

  const { data } = await admin
    .from("subscriptions")
    .insert(payload)
    .select("*")
    .single();
  return (data as Subscription) || null;
}

export function mapStripeStatus(
  status: Stripe.Subscription.Status
): Subscription["status"] {
  switch (status) {
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "incomplete";
    case "trialing":
      return "trialing";
    case "paused":
      return "paused";
    default:
      return "active";
  }
}
