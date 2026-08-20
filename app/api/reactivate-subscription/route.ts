import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { getOrCreateCustomer, createRecurringSubscription } from "@/lib/billing";
import { createRecurringSubscriptionMp, resumeMpSubscription } from "@/lib/mercadopago";

export const runtime = "nodejs";

/**
 * Reativa a assinatura cancelada:
 *  - Se ainda existe no Stripe, remove cancelamento agendado (resume).
 *  - Se não existe, cria uma nova assinatura recorrente.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const profile = await getProfile(user.id);
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const { data: sub } = await admin
    .from("subscriptions")
    .select("*, plan:plan_id(*)")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return NextResponse.json({ error: "Nenhuma assinatura para reativar" }, { status: 400 });

  const { data: tenantRow } = await admin
    .from("tenants")
    .select("monthly_billing_enabled")
    .eq("id", tenant.id)
    .maybeSingle();
  const billingEnabled = tenantRow?.monthly_billing_enabled !== false;

  // Isento de mensalidade: apenas reativa o site localmente (sem cobrança).
  if (!billingEnabled) {
    const { data: localRow } = await admin
      .from("subscriptions")
      .update({
        status: "active",
        cancel_at_period_end: false,
        reactivated_at: new Date().toISOString(),
        canceled_at: null,
      })
      .eq("id", sub.id)
      .select("id")
      .single();
    if (localRow) {
      await admin.from("tenants").update({ site_status: "active", suspended_at: null, reactivated_at: new Date().toISOString() }).eq("id", tenant.id);
      await admin.from("profiles").update({ status: "active" }).eq("user_id", user.id);
    }
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_role: "user",
      action: "subscription.reactivated_no_billing",
      entity_type: "subscription",
      entity_id: sub.id,
      metadata: { tenant_id: tenant.id, monthly_billing_enabled: false },
    });
    return NextResponse.json({ success: true });
  }

  // ---- Mercado Pago ----
  if (sub.gateway === "mercadopago") {
    const plan = sub.plan as {
      id: string;
      name: string;
      monthly_price_cents: number;
      activation_price_cents: number;
      trial_months: number;
    } | null;

    // Tenta retomar a assinatura pausada existente no MP (cancelamento agendado).
    if (sub.mercadopago_subscription_id && (sub.status === "paused" || sub.status === "canceled" || sub.cancel_at_period_end)) {
      try {
        await resumeMpSubscription(sub.mercadopago_subscription_id);
        await admin.from("subscriptions").update({
          status: "active",
          cancel_at_period_end: false,
          reactivated_at: new Date().toISOString(),
          canceled_at: null,
        }).eq("id", sub.id);
        await admin.from("tenants").update({ site_status: "active", suspended_at: null, reactivated_at: new Date().toISOString() }).eq("id", tenant.id);
        await admin.from("profiles").update({ status: "active" }).eq("user_id", user.id);
        await admin.from("audit_logs").insert({
          actor_id: user.id,
          actor_role: "user",
          action: "subscription.reactivated",
          entity_type: "subscription",
          entity_id: sub.id,
          metadata: { tenant_id: tenant.id, gateway: "mercadopago" },
        });
        return NextResponse.json({ success: true });
      } catch {
        // assinatura MP não existe mais → cria nova abaixo
      }
    }

    if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 400 });

    const trialMonths = Math.max(1, plan.trial_months || 3);
    const trialEnd = new Date();
    trialEnd.setMonth(trialEnd.getMonth() + trialMonths);
    const monthlyAmountCents = plan.monthly_price_cents;

    const mpSub = await createRecurringSubscriptionMp({
      planId: plan.id,
      tenantId: tenant.id,
      email: profile?.email || "",
      monthlyAmountCents,
      trialEnd: trialEnd.toISOString(),
    });

    await admin.from("subscriptions").insert({
      tenant_id: tenant.id,
      plan_id: plan.id,
      gateway: "mercadopago",
      mercadopago_subscription_id: mpSub.id,
      mercadopago_plan_id: mpSub.plan_id || null,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd.toISOString(),
      next_billing_at: trialEnd.toISOString(),
      trial_end: trialEnd.toISOString(),
      reactivated_at: new Date().toISOString(),
      snapshot: {
        gateway: "mercadopago",
        plan_id: plan.id,
        currency: "brl",
        activation_amount_cents: plan.activation_price_cents,
        monthly_amount_cents: monthlyAmountCents,
        trial_months: trialMonths,
        trial_period_days: trialMonths * 30,
      },
    });

    await admin.from("tenants").update({ site_status: "active", suspended_at: null, reactivated_at: new Date().toISOString() }).eq("id", tenant.id);
    await admin.from("profiles").update({ status: "active" }).eq("user_id", user.id);
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_role: "user",
      action: "subscription.reactivated",
      entity_type: "subscription",
      entity_id: sub.id,
      metadata: { tenant_id: tenant.id, gateway: "mercadopago", new_subscription: true },
    });
    return NextResponse.json({ success: true });
  }

  const stripe = getStripe();
  const plan = sub.plan as { id: string; monthly_price_cents: number; billing_interval: string; code: string; name: string; activation_price_cents: number; stripe_product_id: string | null; stripe_price_id: string | null } | null;

  if (sub.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: false });
      await admin.from("subscriptions").update({ cancel_at_period_end: false, status: "active", reactivated_at: new Date().toISOString() }).eq("id", sub.id);
      await admin.from("tenants").update({ site_status: "active", suspended_at: null, reactivated_at: new Date().toISOString() }).eq("id", tenant.id);
      await admin.from("profiles").update({ status: "active" }).eq("user_id", user.id);

      await admin.from("audit_logs").insert({
        actor_id: user.id,
        actor_role: "user",
        action: "subscription.reactivated",
        entity_type: "subscription",
        entity_id: sub.id,
        metadata: { tenant_id: tenant.id },
      });
      return NextResponse.json({ success: true });
    } catch {
      // assinatura não existe mais no Stripe → cria nova
    }
  }

  if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 400 });

  const customer = await getOrCreateCustomer({
    userId: user.id,
    tenantId: tenant.id,
    email: profile?.email || "",
    name: profile?.name ?? null,
  });

  const newSub = await createRecurringSubscription(customer.id, {
    userId: user.id,
    tenantId: tenant.id,
    email: profile?.email || "",
    name: profile?.name ?? null,
    planId: plan.id,
  });

  await admin.from("subscriptions").insert({
    tenant_id: tenant.id,
    plan_id: plan.id,
    stripe_customer_id: customer.id,
    stripe_subscription_id: newSub.id,
    status: newSub.status === "active" ? "active" : "incomplete",
    current_period_start: new Date(newSub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(newSub.current_period_end * 1000).toISOString(),
    next_billing_at: new Date(newSub.current_period_end * 1000).toISOString(),
    reactivated_at: new Date().toISOString(),
  });

  await admin.from("tenants").update({ site_status: "active", suspended_at: null, reactivated_at: new Date().toISOString() }).eq("id", tenant.id);
  await admin.from("profiles").update({ status: "active" }).eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
