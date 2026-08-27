import { NextResponse } from "next/server";
import { getStripeResolved } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { getOrCreateCustomer, resolveActivationPriceId } from "@/lib/billing";
import { getActiveOffer, getPlanById } from "@/lib/commercial";
import type { Plan } from "@/types";
import { getPublicBaseUrl } from "@/lib/public-url";
import { resolveGateways } from "@/lib/gateway-config";
import { createActivationPreference } from "@/lib/mercadopago";

export const runtime = "nodejs";

/**
 * Inicia o fluxo de contratação (ATIVAÇÃO):
 *  - Cria uma Checkout Session (pagamento ÚNICO) com o Price de ativação
 *    cadastrado na configuração comercial do Super Admin (tabela plans).
 *  - A confirmação definitiva do pagamento acontece pelo WEBHOOK, que cria o
 *    Customer + assinatura mensal recorrente com primeira cobrança após o
 *    período configurado. O frontend nunca é a fonte de verdade.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const planId = body.planId as string | undefined;
  const embedded = Boolean(body.embedded);

  const admin = createAdminClient();
  const profile = await getProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 400 });

  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  // Plano = oferta comercial (fonte de verdade). Sem planId, usa a oferta ativa.
  let plan: Plan | null = null;
  if (planId) {
    const { data: p } = await admin
      .from("plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .neq("status", "inactive")
      .maybeSingle();
    plan = (p as Plan | null) || null;
  }
  if (!plan) plan = await getActiveOffer();
  if (!plan) return NextResponse.json({ error: "Nenhuma oferta ativa disponível" }, { status: 400 });

  // ---- Gateway definido pelo Super Admin (/admin/pagamentos) decide o fluxo ----
  const gateways = await resolveGateways();
  if (gateways.gateway === "mercadopago") {
    if (!gateways.mercadopago.accessToken) {
      return NextResponse.json(
        { error: "Mercado Pago selecionado, mas sem Access Token configurado." },
        { status: 503 }
      );
    }
    const preference = await createActivationPreference({
      tenantId: tenant.id,
      planId: plan.id,
      email: profile.email,
      name: profile.name,
      activationAmountCents: plan.activation_price_cents,
      planName: plan.name,
    });
    // Transparente: devolve initPoint para iframe; fluxo normal devolve url para redirect.
    return NextResponse.json({ url: preference.initPoint, gateway: "mercadopago", preferenceId: preference.id, embedded });
  }

  if (!gateways.stripe.secretKey) {
    return NextResponse.json(
      { error: "Stripe selecionado, mas sem Secret Key configurada." },
      { status: 503 }
    );
  }

  const appUrl = getPublicBaseUrl();
  const stripe = await getStripeResolved();

  const customer = await getOrCreateCustomer({
    userId: user.id,
    tenantId: tenant.id,
    email: profile.email,
    name: profile.name,
  });

  const metadata: Record<string, string> = { tenant_id: tenant.id, type: "activation", plan_id: plan.id };

  if (embedded) {
    // Checkout Transparente — Embedded Checkout (sem sair do site)
    const session = await stripe.checkout.sessions.create({
      // @ts-ignore — ui_mode embedded é suportado na API 2024-06-20
      ui_mode: "embedded",
      mode: "payment",
      line_items: [{ price: await resolveActivationPriceId(plan.id), quantity: 1 }],
      customer: customer.id,
      metadata,
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
      return_url: `${appUrl}/painel/assinatura?sucesso=1`,
    } as any);
    return NextResponse.json({ gateway: "stripe", clientSecret: (session as any).client_secret, url: session.url, embedded: true });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: await resolveActivationPriceId(plan.id), quantity: 1 }],
    customer: customer.id,
    metadata,
    payment_intent_data: {
      // Salva o cartão como método de pagamento padrão do Customer para
      // cobranças off-session — usado pela mensalidade que será criada após
      // a ativação (primeira cobrança apenas no período configurado).
      setup_future_usage: "off_session",
    },
    success_url: `${appUrl}/painel/assinatura?sucesso=1`,
    cancel_url: `${appUrl}/painel/assinatura`,
  });

  return NextResponse.json({ url: session.url, gateway: "stripe" });
}
