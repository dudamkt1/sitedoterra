import { NextResponse } from "next/server";
import { getStripeResolved } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { pauseMpSubscription } from "@/lib/mercadopago";

export const runtime = "nodejs";

/**
 * Cancela a assinatura ao final do período vigente.
 *  - Stripe: cancel_at_period_end (webhook confirma no fim do período).
 *  - Mercado Pago: pausa a assinatura (para as cobranças, mantém o registro e
 *    permite reativação); o site segue público até o fim do período pago.
 * Dados NÃO são apagados; a recorrência é interrompida.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ error: "Nenhuma assinatura ativa para cancelar" }, { status: 400 });
  }

  // ---- Mercado Pago ----
  if (sub.gateway === "mercadopago") {
    if (!sub.mercadopago_subscription_id) {
      return NextResponse.json({ error: "Nenhuma assinatura ativa para cancelar" }, { status: 400 });
    }
    try {
      await pauseMpSubscription(sub.mercadopago_subscription_id);
    } catch (err) {
      console.error("Falha ao pausar assinatura no Mercado Pago", err);
      return NextResponse.json({ error: "Falha ao cancelar a assinatura. Tente novamente." }, { status: 502 });
    }

    // Cancelamento agendado: site público até o fim do período; finalização
    // automática ocorre ao expirar o período (getDashboardContext) ou na reativação.
    await admin.from("subscriptions").update({
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
    }).eq("id", sub.id);

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_role: "user",
      action: "subscription.cancel_requested",
      entity_type: "subscription",
      entity_id: sub.id,
      metadata: { tenant_id: tenant.id, gateway: "mercadopago" },
    });

    return NextResponse.json({ success: true });
  }

  // ---- Stripe ----
  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: "Nenhuma assinatura ativa para cancelar" }, { status: 400 });
  }

  const stripe = await getStripeResolved();
  await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });

  // Status local: cancelamento agendado (webhook confirmará ao final do período)
  await admin.from("subscriptions").update({ cancel_at_period_end: true }).eq("id", sub.id);

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "user",
    action: "subscription.cancel_requested",
    entity_type: "subscription",
    entity_id: sub.id,
    metadata: { tenant_id: tenant.id },
  });

  return NextResponse.json({ success: true });
}
