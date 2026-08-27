import { NextResponse } from "next/server";
import { resolveGateways } from "@/lib/gateway-config";
import { getActiveOffer } from "@/lib/commercial";

export const runtime = "nodejs";

/**
 * GET /api/gateway
 * Público — usado pelo checkout transparente da HOME para saber qual gateway
 * está ativo e quais chaves públicas usar no frontend (sem expor segredos).
 */
export async function GET() {
  const gateways = await resolveGateways();
  const offer = await getActiveOffer();

  return NextResponse.json({
    gateway: gateways.gateway,
    stripe: {
      publishableKey: gateways.stripe.publishableKey || null,
      hasSecret: Boolean(gateways.stripe.secretKey),
    },
    mercadopago: {
      sandbox: gateways.mercadopago.sandbox,
      hasToken: Boolean(gateways.mercadopago.accessToken),
    },
    offer: offer
      ? {
          id: offer.id,
          name: offer.name,
          activation_price_cents: offer.activation_price_cents,
          activation_regular_price_cents: offer.activation_regular_price_cents,
          monthly_price_cents: offer.monthly_price_cents,
          trial_months: offer.trial_months,
          currency: "BRL",
        }
      : null,
  });
}
