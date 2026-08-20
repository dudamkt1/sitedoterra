import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOffer, getPlanById } from "@/lib/commercial";
import type { Subscription } from "@/types";

export interface BillingUser {
  userId: string;
  tenantId: string;
  email: string;
  name: string | null;
}

/** Price ID da ativação (R$ 297,00 — one-time). Fallback: variável de ambiente. */
export function getActivationPriceId(): string {
  const id = process.env.STRIPE_ACTIVATION_PRICE_ID;
  if (!id) throw new Error("STRIPE_ACTIVATION_PRICE_ID não configurada no ambiente");
  return id;
}

/** Price ID da mensalidade (R$ 47,00 — recorrente). Fallback: variável de ambiente. */
export function getMonthlyPriceId(): string {
  const id = process.env.STRIPE_MONTHLY_PRICE_ID;
  if (!id) throw new Error("STRIPE_MONTHLY_PRICE_ID não configurada no ambiente");
  return id;
}

/**
 * Resolve o Price ID da ATIVAÇÃO a partir da configuração comercial (tabela
 * plans — gerenciada pelo Super Admin). Se não houver Price ID cadastrado,
 * usa a variável de ambiente como fallback. O frontend nunca conhece esses IDs.
 */
export async function resolveActivationPriceId(planId?: string | null): Promise<string> {
  const plan = planId ? await getPlanById(planId) : await getActiveOffer();
  if (plan?.activation_price_id) return plan.activation_price_id;
  return getActivationPriceId();
}

/** Resolve o Price ID da MENSALIDADE a partir da configuração comercial. */
export async function resolveMonthlyPriceId(planId?: string | null): Promise<string> {
  const plan = planId ? await getPlanById(planId) : await getActiveOffer();
  if (plan?.monthly_price_id) return plan.monthly_price_id;
  return getMonthlyPriceId();
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

  // 1) Já vinculado ao tenant (persistido no momento do primeiro checkout)
  const { data: tenant } = await admin
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", metadata.tenantId)
    .maybeSingle();

  if (tenant?.stripe_customer_id) {
    return (await stripe.customers.retrieve(tenant.stripe_customer_id)) as Stripe.Customer;
  }

  // 2) Fallback: vinculado em alguma assinatura existente
  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", metadata.tenantId)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (existingSub?.stripe_customer_id) {
    await admin
      .from("tenants")
      .update({ stripe_customer_id: existingSub.stripe_customer_id })
      .eq("id", metadata.tenantId);
    return (await stripe.customers.retrieve(existingSub.stripe_customer_id)) as Stripe.Customer;
  }

  // 3) Cria e persiste no tenant para nunca duplicar Customers
  const customer = await stripe.customers.create({
    email: metadata.email,
    name: metadata.name || undefined,
    metadata: { tenant_id: metadata.tenantId, user_id: metadata.userId },
  });

  await admin
    .from("tenants")
    .update({ stripe_customer_id: customer.id })
    .eq("id", metadata.tenantId);

  return customer;
}

/**
 * Adiciona `months` meses a uma data, preservando o dia do mês
 * (com clamp para meses mais curtos, ex.: 31 → último dia).
 */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

/**
 * Ativa tenant + perfil: marca conta ativa e site ativo.
 * Só ativa quando há assinatura ativa (evita ativação sem pagamento recorrente confirmado).
 * Fonte compartilhada entre os webhooks de Stripe e Mercado Pago.
 */
export async function activateTenant(tenantId: string, userId?: string) {
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub?.status === "active") {
    await admin.from("tenants").update({ site_status: "active", suspended_at: null }).eq("id", tenantId);
    if (userId) {
      await admin.from("profiles").update({ status: "active", activated_at: new Date().toISOString() }).eq("user_id", userId);
    } else {
      const { data: t } = await admin.from("tenants").select("user_id").eq("id", tenantId).single();
      if (t?.user_id) {
        await admin.from("profiles").update({ status: "active", activated_at: new Date().toISOString() }).eq("user_id", t.user_id);
      }
    }
  }
}

/**
 * Cria a assinatura recorrente (ex.: R$ 47,00/mês) com primeira cobrança
 * apenas após o número de MESES definido na configuração comercial
 * (trial_months — Super Admin decide em /admin/planos).
 * O Price ID vem da tabela `plans` (Super Admin) com fallback para env.
 */
export async function createRecurringSubscription(
  customerId: string,
  metadata: BillingUser & { planId?: string | null }
): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  const plan = metadata.planId ? await getPlanById(metadata.planId) : await getActiveOffer();
  const priceId = plan?.monthly_price_id || getMonthlyPriceId();
  const trialMonths = Math.max(1, plan?.trial_months || 3);

  const anchor = Math.floor(addMonths(new Date(), trialMonths).getTime() / 1000);

  const subMetadata: Record<string, string> = {
    tenant_id: metadata.tenantId,
    user_id: metadata.userId,
  };
  if (metadata.planId) subMetadata.plan_id = metadata.planId;

  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
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
  };

  // Sincroniza o customer no tenant (evita duplicar Customers Stripe)
  await admin
    .from("tenants")
    .update({ stripe_customer_id: payload.stripe_customer_id })
    .eq("id", tenantId);

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  if (existing) {
    const { data } = await admin
      .from("subscriptions")
      .update({
        ...payload,
        // Reativação (active) limpa a data de cancelamento; cancelamento marca.
        canceled_at: sub.status === "canceled" ? new Date().toISOString() : null,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    return (data as Subscription) || null;
  }

  const { data } = await admin
    .from("subscriptions")
    .insert({
      ...payload,
      activated_at: sub.status === "active" ? new Date().toISOString() : null,
      canceled_at: sub.status === "canceled" ? new Date().toISOString() : null,
    })
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
