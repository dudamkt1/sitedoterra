import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { getOrCreateCustomer, createRecurringSubscription } from "@/lib/billing";

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
