import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Subscription } from "@/types";

export interface BillingUser {
  userId: string;
  tenantId: string;
  email: string;
  name: string | null;
}

/** Price ID da ativação (R$ 297,00 — one-time). Fonte: variável de ambiente. */
export function getActivationPriceId(): string {
  const id = process.env.STRIPE_ACTIVATION_PRICE_ID;
  if (!id) throw new Error("STRIPE_ACTIVATION_PRICE_ID não configurada no ambiente");
  return id;
}

/** Price ID da mensalidade (R$ 47,00 — recorrente). Fonte: variável de ambiente. */
export function getMonthlyPriceId(): string {
  const id = process.env.STRIPE_MONTHLY_PRICE_ID;
  if (!id) throw new Error("STRIPE_MONTHLY_PRICE_ID não configurada no ambiente");
  return id;
}

/** Retorna o objeto Price da ativação a partir do Stripe (fonte dos valores exibidos). */
export async function getActivationPrice(): Promise<Stripe.Price> {
  return getStripe().prices.retrieve(getActivationPriceId());
}

/** Retorna o objeto Price da mensalidade a partir do Stripe (fonte dos valores exibidos). */
export async function getMonthlyPrice(): Promise<Stripe.Price> {
  return getStripe().prices.retrieve(getMonthlyPriceId());
}

/** Busca ou cria um Customer no Stripe para o usuário (reutiliza se já existir). */
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
 * Cria a assinatura recorrente de R$ 47,00/mês com billing_cycle_anchor em +30 dias:
 * a primeira mensalidade é cobrada somente 1 mês após a ativação.
 */
export async function createRecurringSubscription(
  customerId: string,
  metadata: BillingUser & { planId?: string | null }
): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  const anchor = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  const subMetadata: Record<string, string> = {
    tenant_id: metadata.tenantId,
    user_id: metadata.userId,
  };
  if (metadata.planId) subMetadata.plan_id = metadata.planId;

  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: getMonthlyPriceId() }],
    billing_cycle_anchor: anchor,
    proration_behavior: "none",
    payment_behavior: "allow_incomplete",
    metadata: subMetadata,
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
