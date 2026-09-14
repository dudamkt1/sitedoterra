import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStripeResolved } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { getOrCreateCustomer, resolveActivationPriceId } from "@/lib/billing";
import { getPublicBaseUrl } from "@/lib/public-url";
import { resolveGateways } from "@/lib/gateway-config";
import { createActivationPreference } from "@/lib/mercadopago";
import {
  buildCheckoutQuote,
  fulfillZeroChargePayment,
  QuoteError,
  type CheckoutQuote,
} from "@/lib/checkout-quote";

const VISITOR_TOKEN_COOKIE = "tc_visitor_token";

export const runtime = "nodejs";

/**
 * Inicia o fluxo de contratação (ATIVAÇÃO) ou de pagamento de MENSALIDADE:
 *  - ATIVAÇÃO: pagamento ÚNICO (Stripe Checkout ou preferência MP).
 *  - MENSALIDADE (`type: "subscription"`): pagamento único avulso referente
 *    à mensalidade (útil quando está vencida ou para usar crédito).
 *  - O frontend envia apenas intenções (`type`, `payMethod`,
 *    `useAffiliateCredit`): todos os valores são calculados no backend
 *    (buildCheckoutQuote) — o frontend nunca é fonte de verdade.
 *  - Crédito 100% (total R$ 0,00): cumprido de forma síncrona, sem gateway.
 *  - A confirmação definitiva de pagamentos com gateway acontece pelo WEBHOOK.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const planId = body.planId as string | undefined;
  const embedded = Boolean(body.embedded);
  const kind = body.type === "subscription" ? "subscription" : "activation";
  // Método escolhido pelo cliente na tela de pagamento ("pix" | "card").
  // O Mercado Pago recebe o valor já alinhado ao método + a restrição de
  // meios — o usuário não escolhe novamente dentro do gateway.
  const payMethod = body.payMethod === "pix" ? "pix" : "card";
  // Uso de crédito de afiliado: só a INTENÇÃO vem do frontend; saldo,
  // cálculo e reserva acontecem no backend (buildCheckoutQuote).
  const useAffiliateCredit = body.useAffiliateCredit === true;
  // Destino pós-pagamento (whitelist interna — evita open redirect).
  // Após a confirmação, o usuário permanece no painel, em /painel/meu-site
  // (com ?ativado=1, que exibe o aviso de "Pagamento recebido").
  const rawSuccessPath = typeof body.successPath === "string" ? body.successPath : "";
  const successPath = /^\/painel\/(meu-site|assinatura)(\?.*)?$/.test(rawSuccessPath)
    ? rawSuccessPath
    : "/painel/meu-site?ativado=1";

  const admin = createAdminClient();
  const profile = await getProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 400 });

  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  // ---- Gateway definido pelo Super Admin (/admin/pagamentos) decide o fluxo ----
  // visitor_token: persiste a atribuição do afiliado até o webhook de pagamento.
  // Lido do cookie first-party definido por /api/affiliate/click.
  const cookieStore = await cookies();
  const visitorToken = cookieStore.get(VISITOR_TOKEN_COOKIE)?.value || null;

  const gateways = await resolveGateways();
  const pixDiscount = Math.min(50, Math.max(0, Number(gateways.mercadopago.pixDiscountPercent) || 0));

  let quote: CheckoutQuote;
  try {
    quote = await buildCheckoutQuote({
      userId: user.id,
      tenantId: tenant.id,
      planId,
      kind,
      payMethod,
      useAffiliateCredit,
      pixDiscountPercent: pixDiscount,
    });
  } catch (e) {
    if (e instanceof QuoteError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
  const plan = quote.plan;
  const creditPayload = {
    original_cents: quote.originalCents,
    credit_cents: quote.creditCents,
    total_cents: quote.totalCents,
    usage_id: quote.usageId,
  };

  // ---- Crédito cobre 100%: sem gateway, sem cobrança — cumprimento síncrono.
  if (quote.totalCents <= 0 && quote.usageId) {
    try {
      await fulfillZeroChargePayment({ userId: user.id, tenantId: tenant.id, quote });
    } catch (e) {
      if (e instanceof QuoteError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
    return NextResponse.json({ zeroCharge: true, gateway: "affiliate_credit", credit: creditPayload });
  }

  const pendingMetaBase = {
    type: kind,
    plan_id: plan.id,
    ...(quote.subscriptionId ? { subscription_id: quote.subscriptionId } : {}),
    ...(quote.usageId ? { credit_usage_id: quote.usageId } : {}),
    ...(quote.creditCents > 0
      ? { credit_applied_cents: quote.creditCents, original_amount_cents: quote.originalCents }
      : {}),
  };

  if (gateways.gateway === "mercadopago") {
    if (!gateways.mercadopago.accessToken) {
      return NextResponse.json(
        { error: "Mercado Pago selecionado, mas sem Access Token configurado." },
        { status: 503 }
      );
    }
    try {
      const preference = await createActivationPreference({
        tenantId: tenant.id,
        planId: plan.id,
        email: profile.email,
        name: profile.name,
        activationAmountCents: quote.totalCents,
        planName: plan.name,
        visitorToken,
        successPath,
        payMethod,
        chargeKind: kind,
        subscriptionId: quote.subscriptionId,
        creditUsageId: quote.usageId,
        creditAppliedCents: quote.creditCents > 0 ? quote.creditCents : null,
        originalAmountCents: quote.creditCents > 0 ? quote.originalCents : null,
        itemTitle:
          kind === "subscription" ? `${plan.name} — Mensalidade` : `${plan.name} — Ativação do site`,
      });
      // Cria registro de pagamento pending no banco para permitir reaproveitamento
      // se o usuário fechar a aba sem concluir.
      await admin.from("payments").insert({
        tenant_id: tenant.id,
        subscription_id: quote.subscriptionId,
        type: kind,
        amount_cents: quote.totalCents,
        currency: "brl",
        status: "pending",
        metadata: { gateway: "mercadopago", preference_id: preference.id, ...pendingMetaBase },
      });
      // Transparente: devolve initPoint para iframe; fluxo normal devolve url para redirect.
      return NextResponse.json({ url: preference.initPoint, gateway: "mercadopago", preferenceId: preference.id, embedded, credit: creditPayload });
    } catch (e) {
      // SEMPRE retorna JSON (nunca 500 com HTML): o frontend faz
      // `res.json()` e um corpo vazio/HTML quebrava com
      // "Unexpected end of JSON input" na tela de erro.
      console.error("[checkout] falha ao criar preferência Mercado Pago", e);
      const message = e instanceof Error ? e.message : "";
      const clean = message
        .replace(/Mercado Pago API[^\:]*:\s*/i, "")
        .replace(/\(.*\)/, "")
        .trim();
      return NextResponse.json(
        { error: clean.slice(0, 300) || "Não foi possível iniciar o pagamento no Mercado Pago. Tente novamente ou escolha outra forma de pagamento." },
        { status: 502 }
      );
    }
  }

  if (!gateways.stripe.secretKey) {
    return NextResponse.json(
      { error: "Stripe selecionado, mas sem Secret Key configurada." },
      { status: 503 }
    );
  }

  try {
    const appUrl = getPublicBaseUrl();
    const stripe = await getStripeResolved();

    const customer = await getOrCreateCustomer({
      userId: user.id,
      tenantId: tenant.id,
      email: profile.email,
      name: profile.name,
    });

  // metadata do Stripe (limite 500 chars por valor; UUIDs cabem sem problemas).
  const metadata: Record<string, string> = {
    tenant_id: tenant.id,
    type: kind,
    plan_id: plan.id,
    expected_total_cents: String(quote.totalCents),
  };
    if (visitorToken) metadata.visitor_token = visitorToken;
    if (quote.subscriptionId) metadata.subscription_id = quote.subscriptionId;
    if (quote.usageId) metadata.credit_usage_id = quote.usageId;
    if (quote.creditCents > 0) {
      metadata.credit_applied_cents = String(quote.creditCents);
      metadata.original_amount_cents = String(quote.originalCents);
    }

    // Com crédito (ou mensalidade avulsa), o valor não corresponde a um Price
    // fixo: usa price_data ad hoc com o total calculado no backend.
    const needsAdHocPrice = quote.creditCents > 0 || kind === "subscription";
    const lineItems = needsAdHocPrice
      ? [
          {
            price_data: {
              currency: "brl",
              unit_amount: quote.totalCents,
              product_data: {
                name:
                  kind === "subscription"
                    ? `${plan.name} — Mensalidade`
                    : `${plan.name} — Ativação do site`,
              },
            },
            quantity: 1,
          },
        ]
      : [{ price: await resolveActivationPriceId(plan.id), quantity: 1 }];

    if (embedded) {
      // Checkout Transparente — Embedded Checkout (sem sair do site).
      // Funciona tanto com Price fixo quanto com price_data ad hoc (crédito).
      const session = await stripe.checkout.sessions.create({
        // @ts-ignore — ui_mode embedded é suportado na API 2024-06-20
        ui_mode: "embedded",
        mode: "payment",
        line_items: lineItems,
        customer: customer.id,
        metadata,
        payment_intent_data: {
          setup_future_usage: "off_session",
        },
        return_url: `${appUrl}${successPath}`,
      } as any);
      // Cria registro de pagamento pending no banco para permitir reaproveitamento
      await admin.from("payments").insert({
        tenant_id: tenant.id,
        subscription_id: quote.subscriptionId,
        type: kind,
        amount_cents: quote.totalCents,
        currency: "brl",
        status: "pending",
        metadata: { gateway: "stripe", stripe_checkout_session_id: (session as any).id, ...pendingMetaBase },
      });
      return NextResponse.json({ gateway: "stripe", clientSecret: (session as any).client_secret, url: session.url, embedded: true, credit: creditPayload });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer: customer.id,
      metadata,
      payment_intent_data: {
        // Salva o cartão como método de pagamento padrão do Customer para
        // cobranças off-session — usado pela mensalidade que será criada após
        // a ativação (primeira cobrança apenas no período configurado).
        setup_future_usage: "off_session",
      },
      success_url: `${appUrl}${successPath}`,
      cancel_url: `${appUrl}/painel/assinatura`,
    });

    // Cria registro de pagamento pending no banco para permitir reaproveitamento
    await admin.from("payments").insert({
      tenant_id: tenant.id,
      subscription_id: quote.subscriptionId,
      type: kind,
      amount_cents: quote.totalCents,
      currency: "brl",
      status: "pending",
      metadata: { gateway: "stripe", stripe_checkout_session_id: session.id, ...pendingMetaBase },
    });

    return NextResponse.json({ url: session.url, gateway: "stripe", credit: creditPayload });
  } catch (e) {
    // SEMPRE retorna JSON (nunca 500 com HTML): o frontend faz
    // `res.json()` e um corpo vazio/HTML quebrava com
    // "Unexpected end of JSON input" na tela de erro.
    console.error("[checkout] falha ao criar sessão Stripe", e);
    return NextResponse.json(
      { error: "Não foi possível iniciar o pagamento no Stripe. Tente novamente ou escolha outra forma de pagamento." },
      { status: 502 }
    );
  }
}
