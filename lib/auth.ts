import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureTenantForUser } from "@/lib/onboarding";
import type { Profile, Subscription, Tenant, Domain, Plan } from "@/types";

export async function getCurrentUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId?: string): Promise<Profile | null> {
  const user = userId || (await getCurrentUser())?.id;
  if (!user) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user)
    .single();
  return (data as Profile) || null;
}

export interface DashboardContext {
  profile: Profile | null;
  tenant: (Tenant & { site_data: Record<string, unknown> | null }) | null;
  subscription: (Subscription & { plan?: Plan | null }) | null;
  domains: Domain[];
  plans: Plan[];
  isSuperAdmin: boolean;
}

/**
 * Monta o contexto do painel do usuário logado.
 * NUNCA deve ser usado para acesso público — retorna null se não autenticado.
 */
export async function getDashboardContext(): Promise<DashboardContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = createAdminClient();
  const profile = await getProfile(user.id);
  if (!profile) return null;

  // Garante tenant/site_settings existentes para o usuário
  await ensureTenantForUser(user.id);

  const { data: tenantRow } = await admin
    .from("tenants")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const tenant = (tenantRow as Tenant | null) || null;

  const [subResult, domainsResult, plansResult, settingsResult] = await Promise.all([
    tenant
      ? admin
          .from("subscriptions")
          .select("*, plan:plan_id(*)")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    tenant
      ? admin
          .from("domains")
          .select("*")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    admin.from("plans").select("*").eq("is_active", true).order("created_at"),
    tenant
      ? admin.from("site_settings").select("data").eq("tenant_id", tenant.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const subscription = (subResult.data as (Subscription & { plan?: Plan | null }) | null) || null;

  // Finalização "preguiçosa" de cancelamento agendado no Mercado Pago:
  // sem cron, quando o período pago termina, o próximo acesso ao painel
  // converte o cancelamento agendado em "canceled" e suspende o site.
  if (
    subscription &&
    tenant &&
    subscription.gateway === "mercadopago" &&
    subscription.cancel_at_period_end &&
    (subscription.status === "active" || subscription.status === "paused") &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end).getTime() <= Date.now()
  ) {
    await admin
      .from("subscriptions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_at_period_end: false,
      })
      .eq("id", subscription.id);

    const { data: tenantRow } = await admin
      .from("tenants")
      .select("monthly_billing_enabled")
      .eq("id", tenant.id)
      .maybeSingle();
    if (tenantRow?.monthly_billing_enabled !== false) {
      await admin
        .from("tenants")
        .update({ site_status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", tenant.id);
    }
    subscription.status = "canceled";
    subscription.cancel_at_period_end = false;
  }

  return {
    profile,
    tenant: tenant ? { ...tenant, site_data: (settingsResult.data?.data as Record<string, unknown>) || null } : null,
    subscription,
    domains: (domainsResult.data as Domain[]) || [],
    plans: (plansResult.data as Plan[]) || [],
    isSuperAdmin: profile.role === "superadmin",
  };
}
