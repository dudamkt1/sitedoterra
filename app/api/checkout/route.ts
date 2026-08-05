import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { getActivationPriceId, getOrCreateCustomer } from "@/lib/billing";

export const runtime = "nodejs";

/**
 * Inicia o fluxo de contratação (ATIVAÇÃO):
 *  - Cria uma Checkout Session (pagamento ÚNICO) com o Price de ativação
 *    configurado em STRIPE_ACTIVATION_PRICE_ID (R$ 297,00).
 *  - A confirmação definitiva do pagamento acontece pelo WEBHOOK, que cria o
 *    Customer + assinatura mensal recorrente (R$ 47,00) com primeira cobrança
 *    apenas 1 mês após a ativação. O frontend nunca é a fonte de verdade.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { planId } = await request.json();

  const admin = createAdminClient();
  const profile = await getProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 400 });

  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  let plan: { id: string } | null = null;
  if (planId) {
    const { data: p } = await admin
      .from("plans")
      .select("id")
      .eq("id", planId)
      .eq("is_active", true)
      .maybeSingle();
    plan = p || null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const stripe = getStripe();

  const customer = await getOrCreateCustomer({
    userId: user.id,
    tenantId: tenant.id,
    email: profile.email,
    name: profile.name,
  });

  const metadata: Record<string, string> = { tenant_id: tenant.id, type: "activation" };
  if (plan?.id) metadata.plan_id = plan.id;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: getActivationPriceId(), quantity: 1 }],
    customer: customer.id,
    metadata,
    success_url: `${appUrl}/painel/assinatura?sucesso=1`,
    cancel_url: `${appUrl}/painel/assinatura`,
  });

  return NextResponse.json({ url: session.url });
}
