import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { resolveGateways } from "@/lib/gateway-config";
import { processBrickPayment } from "@/lib/mercadopago";
import {
  buildCheckoutQuote,
  QuoteError,
  type CheckoutQuote,
} from "@/lib/checkout-quote";

const VISITOR_TOKEN_COOKIE = "tc_visitor_token";

export const runtime = "nodejs";

/**
 * POST /api/checkout/mp/process — processa o pagamento do Payment Brick
 * (cartão ou Pix) via Payments API, SEM redirect externo.
 *
 * O frontend envia o `formData` gerado pelo Brick (token do cartão,
 * payment_method_id, installments, payer) + intenções (`payMethod`,
 * `useAffiliateCredit`, `type`). O VALOR é sempre recalculado aqui
 * (buildCheckoutQuote: oferta comercial + desconto PIX + crédito de afiliado
 * com reserva atômica) — nunca confia no cliente.
 *
 * A ativação continua acontecendo SOMENTE pelo webhook
 * (/api/webhooks/mercadopago), que usa o mesmo external_reference/metadata
 * da Preference. O frontend nunca é fonte de verdade.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const gateways = await resolveGateways();
  if (gateways.gateway !== "mercadopago" || !gateways.mercadopago.accessToken) {
    return NextResponse.json(
      { error: "Pagamento via Mercado Pago indisponível no momento." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const planId = typeof body.planId === "string" ? body.planId : undefined;
  const formData =
    body.formData && typeof body.formData === "object" ? body.formData : null;
  if (!formData) {
    return NextResponse.json({ error: "Dados do pagamento não recebidos." }, { status: 400 });
  }
  const kind = body.type === "subscription" ? "subscription" : "activation";
  const payMethod = body.payMethod === "pix" ? "pix" : "card";
  const useAffiliateCredit = body.useAffiliateCredit === true;

  const admin = createAdminClient();
  const profile = await getProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 400 });

  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

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
  if (quote.totalCents <= 0) {
    return NextResponse.json(
      { error: "Valor zerado pelo crédito — conclua pelo checkout." },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const visitorToken = cookieStore.get(VISITOR_TOKEN_COOKIE)?.value || null;

  const fullName = String((profile as { name?: unknown }).name || "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);

  try {
    const payment = await processBrickPayment({
      tenantId: tenant.id,
      planId: quote.plan.id,
      email: profile.email,
      firstName: firstName || null,
      lastName: rest.length > 0 ? rest.join(" ") : null,
      // Base do método (cotação) — desconto PIX e crédito aplicados no servidor.
      activationAmountCents: quote.originalCents,
      planName: quote.plan.name,
      visitorToken,
      // Config oficial: desconto aplicado SOMENTE se o método efetivo for pix.
      pixDiscountPercent: pixDiscount,
      expectedPayMethod: payMethod,
      creditCents: quote.creditCents,
      chargeKind: kind,
      subscriptionId: quote.subscriptionId,
      creditUsageId: quote.usageId,
      originalAmountCents: quote.creditCents > 0 ? quote.originalCents : null,
      itemTitle:
        kind === "subscription"
          ? `${quote.plan.name} — Mensalidade`
          : `${quote.plan.name} — Ativação do site`,
      formData,
    });
    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail || null,
      payment_method_id: payment.payment_method_id || null,
      payment_type_id: payment.payment_type_id || null,
      point_of_interaction: payment.point_of_interaction || null,
      credit: {
        original_cents: quote.originalCents,
        credit_cents: quote.creditCents,
        total_cents: quote.totalCents,
        usage_id: quote.usageId,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao processar pagamento.";
    const clean = message
      .replace(/Mercado Pago API[^\:]*:\s*/i, "")
      .replace(/\(.*\)/, "")
      .trim();
    return NextResponse.json(
      { error: clean.slice(0, 300) || "Erro ao processar pagamento." },
      { status: 502 }
    );
  }
}
