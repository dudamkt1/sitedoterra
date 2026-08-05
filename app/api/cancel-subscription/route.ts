import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";

export const runtime = "nodejs";

/**
 * Cancela a assinatura no Stripe (ao final do período vigente).
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

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: "Nenhuma assinatura ativa para cancelar" }, { status: 400 });
  }

  const stripe = getStripe();
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
