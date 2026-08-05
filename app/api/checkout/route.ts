import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { getOrCreateCustomer, getOrCreateActivationPrice, createRecurringSubscription } from "@/lib/billing";

export const runtime = "nodejs";

/**
 * Inicia o fluxo de contratação:
 *  - Se o plano tem valor de ATIVAÇÃO > 0 → Checkout Session (one-time).
 *    Após o pagamento, o webhook cria a assinatura recorrente.
 *  - Se ativação = 0 → cria a assinatura recorrente diretamente.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { planId } = await request.json();
  if (!planId) {
    return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const profile = await getProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 400 });

  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const { data: plan } = await admin.from("plans").select("*").eq("id", planId).eq("is_active", true).single();
  if (!plan) return NextResponse.json({ error: "Plano não encontrado ou inativo" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const stripe = getStripe();

  if (plan.activation_price_cents > 0) {
    const price = await getOrCreateActivationPrice(plan);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: price.id, quantity: 1 }],
      customer_email: profile.email,
      metadata: { tenant_id: tenant.id, plan_id: plan.id, type: "activation" },
      success_url: `${appUrl}/painel/assinatura?sucesso=1`,
      cancel_url: `${appUrl}/painel/assinatura`,
    });
    return NextResponse.json({ url: session.url });
  }

  // Sem ativação: cria a assinatura recorrente imediatamente
  const customer = await getOrCreateCustomer({
    userId: user.id,
    tenantId: tenant.id,
    email: profile.email,
    name: profile.name,
  });
  const sub = await createRecurringSubscription(customer.id, plan, {
    userId: user.id,
    tenantId: tenant.id,
    email: profile.email,
    name: profile.name,
  });
  await admin.from("subscriptions").upsert(
    {
      tenant_id: tenant.id,
      plan_id: plan.id,
      stripe_customer_id: customer.id,
      stripe_subscription_id: sub.id,
      stripe_price_id: plan.stripe_price_id || (sub.items.data[0]?.price?.id as string) || null,
      status: sub.status === "active" ? "active" : "incomplete",
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      next_billing_at: new Date(sub.current_period_end * 1000).toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );

  return NextResponse.json({ success: true });
}
