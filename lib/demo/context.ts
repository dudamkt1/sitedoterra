import { getDemoSessionInfo } from "./auth";
import { buildDemoSeed } from "./seed";
import type { DemoData } from "./types";

export interface DemoDashboardContext {
  isDemo: true;
  profile: {
    id: string;
    user_id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    role: "user";
    created_at: string;
    activated_at: string | null;
    cancelled_at: string | null;
  };
  tenant: {
    id: string;
    slug: string;
    user_id: string;
    site_status: "active";
    site_data: DemoData["site"];
    monthly_billing_enabled: boolean;
  };
  subscription: {
    id: string;
    tenant_id: string;
    plan_id: string;
    status: "active";
    gateway: "demo";
    current_period_end: string;
    next_billing_at: string;
    cancel_at_period_end: false;
    plan: {
      id: string;
      name: string;
      activation_price_cents: number;
      monthly_price_cents: number;
    };
  };
  domains: Array<{ id: string; domain: string; status: "active" }>;
  plans: Array<{
    id: string;
    name: string;
    activation_price_cents: number;
    monthly_price_cents: number;
    is_active: true;
  }>;
  isSuperAdmin: false;
  demoData: DemoData;
  session: { nonce: string; startedAt: string };
}

export async function getDemoDashboardContext(): Promise<DemoDashboardContext | null> {
  const session = await getDemoSessionInfo();
  if (!session) return null;
  const seed = buildDemoSeed();

  return {
    isDemo: true,
    profile: {
      id: "demo-user",
      user_id: "demo-user",
      name: "Acesso Rápido (Demo)",
      email: "acesso-rapido@demonstracao.local",
      phone: null,
      status: "active",
      role: "user",
      created_at: session.startedAt,
      activated_at: session.startedAt,
      cancelled_at: null,
    },
    tenant: {
      id: "demo-tenant",
      slug: "demonstracao",
      user_id: "demo-user",
      site_status: "active",
      site_data: seed.site,
      monthly_billing_enabled: true,
    },
    subscription: {
      id: "demo-sub",
      tenant_id: "demo-tenant",
      plan_id: "demo-plan",
      status: "active",
      gateway: "demo",
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      next_billing_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false,
      plan: {
        id: "demo-plan",
        name: "Plano Essencial",
        activation_price_cents: 9900,
        monthly_price_cents: 4900,
      },
    },
    domains: [
      { id: "demo-domain", domain: "carla.consultoria.local", status: "active" },
    ],
    plans: [
      {
        id: "demo-plan",
        name: "Plano Essencial",
        activation_price_cents: 9900,
        monthly_price_cents: 4900,
        is_active: true,
      },
      {
        id: "demo-plan-pro",
        name: "Plano Premium",
        activation_price_cents: 14900,
        monthly_price_cents: 7900,
        is_active: true,
      },
    ],
    isSuperAdmin: false,
    demoData: seed,
    session,
  };
}
