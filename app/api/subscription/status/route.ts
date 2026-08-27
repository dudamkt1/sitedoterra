import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureTenantForUser } from "@/lib/onboarding";

export const runtime = "nodejs";

/**
 * GET /api/subscription/status
 * Retorna status real da assinatura/ativação do usuário logado.
 * Usado pelo checkout transparente para polling até webhook ativar.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 200 });
  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ authenticated: true, activated: false, site_status: "pending" });

  const [{ data: sub }, { data: payment }] = await Promise.all([
    admin.from("subscriptions").select("status, current_period_end, next_billing_at, trial_end").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("payments").select("id, status, type, created_at").eq("tenant_id", tenant.id).eq("type", "activation").eq("status", "succeeded").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const activated = tenant.site_status === "active" && Boolean(payment);
  const subscriptionStatus = sub?.status || null;

  return NextResponse.json({
    authenticated: true,
    activated,
    site_status: tenant.site_status,
    subscription_status: subscriptionStatus,
    tenant_id: tenant.id,
    hasActivationPayment: Boolean(payment),
    next_billing_at: sub?.next_billing_at || sub?.current_period_end || null,
  });
}
