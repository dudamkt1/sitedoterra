import { createAdminClient } from "@/lib/supabase/admin";

/**
 * CONFIGURAÇÃO CENTRAL DE GATEWAYS DE PAGAMENTO (Super Admin).
 *
 * Fonte: tabela singleton `payment_config` (somente service role — RLS sem
 * políticas). Cada campo cai para a variável de ambiente equivalente quando
 * não preenchido no banco, mantendo compatibilidade com deploys antigos.
 */

export type Gateway = "stripe" | "mercadopago";

export interface GatewayRow {
  id: number;
  gateway: Gateway;
  stripe_secret_key: string | null;
  stripe_publishable_key: string | null;
  stripe_webhook_secret: string | null;
  mercadopago_access_token: string | null;
  mercadopago_webhook_secret: string | null;
  mercadopago_sandbox: boolean;
}

async function getRow(): Promise<GatewayRow | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("payment_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return (data as GatewayRow) || null;
  } catch {
    return null;
  }
}

export interface ResolvedGateways {
  gateway: Gateway;
  stripe: {
    secretKey: string | null;
    webhookSecret: string | null;
    publishableKey: string | null;
  };
  mercadopago: {
    accessToken: string | null;
    webhookSecret: string | null;
    sandbox: boolean;
  };
}

/** Resolve gateway ativo + chaves efetivas (banco → env). */
export async function resolveGateways(): Promise<ResolvedGateways> {
  const row = await getRow();

  const stripeSecret = row?.stripe_secret_key || process.env.STRIPE_SECRET_KEY || null;
  const stripeWebhook =
    row?.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || null;
  const stripePublishable =
    row?.stripe_publishable_key || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;

  const mpToken = row?.mercadopago_access_token || process.env.MERCADOPAGO_ACCESS_TOKEN || null;
  const mpWebhook =
    row?.mercadopago_webhook_secret || process.env.MERCADOPAGO_WEBHOOK_SECRET || null;
  const mpSandbox =
    typeof row?.mercadopago_sandbox === "boolean"
      ? row.mercadopago_sandbox
      : process.env.MERCADOPAGO_SANDBOX === "true";

  let gateway: Gateway = row?.gateway === "mercadopago" ? "mercadopago" : "stripe";
  // Segurança: se o gateway escolhido não tem chave nenhuma configurada,
  // cai automaticamente para o outro (evita checkout quebrado em produção).
  if (gateway === "stripe" && !stripeSecret && mpToken) gateway = "mercadopago";
  if (gateway === "mercadopago" && !mpToken && stripeSecret) gateway = "stripe";

  return {
    gateway,
    stripe: { secretKey: stripeSecret, webhookSecret: stripeWebhook, publishableKey: stripePublishable },
    mercadopago: { accessToken: mpToken, webhookSecret: mpWebhook, sandbox: mpSandbox },
  };
}

export async function getActiveGateway(): Promise<Gateway> {
  return (await resolveGateways()).gateway;
}

// ---------------------------- Helpers usados pelas libs ----------------------------

export async function getStripeSecretKeyResolved(): Promise<string | null> {
  return (await resolveGateways()).stripe.secretKey;
}

export async function getStripeWebhookSecretResolved(): Promise<string | null> {
  return (await resolveGateways()).stripe.webhookSecret;
}

export async function getMercadoPagoTokenResolved(): Promise<string | null> {
  return (await resolveGateways()).mercadopago.accessToken;
}

export async function isMercadoPagoSandboxResolved(): Promise<boolean> {
  return (await resolveGateways()).mercadopago.sandbox;
}
