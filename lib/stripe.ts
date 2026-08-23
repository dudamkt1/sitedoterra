import Stripe from "stripe";
import { getStripeSecretKeyResolved } from "@/lib/gateway-config";

/**
 * Instância Stripe com a chave resolvida (banco → env).
 * Prefira `await getStripeResolved()`; `getStripe()` sync permanece apenas
 * para compatibilidade quando a chave já veio de fora.
 */
export async function getStripeResolved(): Promise<Stripe> {
  const key = await getStripeSecretKeyResolved();
  if (!key) {
    throw new Error("Chave do Stripe não configurada (admin → Pagamentos ou STRIPE_SECRET_KEY)");
  }
  return new Stripe(key, {
    apiVersion: "2024-06-20",
    typescript: true,
  });
}

/** Compatibilidade: usa apenas a env (sem leitura de banco). */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY não configurada no ambiente");
  }
  return new Stripe(key, {
    apiVersion: "2024-06-20",
    typescript: true,
  });
}

export function getStripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
}
