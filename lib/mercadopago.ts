import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanById } from "@/lib/commercial";
import { addMonths } from "@/lib/billing";

/**
 * MERCADO PAGO — cliente server-only (nunca exposto ao browser).
 *
 * FONTE DE VERDADE COMERCIAL continua sendo a tabela `plans` (Super Admin em
 * /admin/planos). O MP apenas CONSUME os valores na hora da contratação e
 * congela os termos no `snapshot` da assinatura. Nenhum preço é hardcoded aqui.
 *
 * Integra via REST direto (sem SDK) para estabilidade e verificabilidade.
 * Endpoints oficiais:
 *   - Checkout Pro:        POST /checkout/preferences
 *   - Planos recorrentes:  POST /v1/plans
 *   - Assinaturas:         POST /v1/subscriptions
 *   - Pagamentos:          GET  /v1/payments/:id
 *   - Assinaturas GET:     GET  /v1/subscriptions/:id
 */

export const MERCADOPAGO_API = "https://api.mercadopago.com";

export function isMercadoPagoEnabled(): boolean {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
}

export function getMercadoPagoAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurada no ambiente");
  return token;
}

async function mpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getMercadoPagoAccessToken();
  const res = await fetch(`${MERCADOPAGO_API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Mercado Pago API ${init.method || "GET"} ${path} falhou (${res.status}): ${text.slice(0, 500)}`
    );
  }
  return res.json() as Promise<T>;
}

// ============================ TIPOS DE RESPOSTA ============================

export interface MpPayment {
  id: number;
  status: string;
  status_detail?: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id?: string | null;
  date_approved: string | null;
  date_created: string;
  payer?: { email?: string | null; first_name?: string | null };
  payment_type_id?: string | null;
  preference_id?: string | null;
  metadata?: Record<string, unknown> | null;
  description?: string | null;
}

export interface MpSubscription {
  id: string;
  status: string;
  date_created?: string;
  start_date?: string | null;
  next_payment_date?: string | null;
  external_reference: string | null;
  plan_id?: string | null;
  payer?: { id?: string; email?: string };
}

// ============================ CHECKOUT (ATIVAÇÃO) ============================

export interface ActivationPreferenceInput {
  tenantId: string;
  planId: string;
  email: string;
  name: string | null;
  activationAmountCents: number;
  planName: string;
}

/**
 * Cria a Payment Preference (Checkout Pro) para o pagamento ÚNICO de ativação.
 * `external_reference` = "act_<tenantId>" identifica o pagamento no webhook.
 * `metadata` replica tenant/plano/type para fallback de rastreamento.
 */
export async function createActivationPreference(
  input: ActivationPreferenceInput
): Promise<{ id: string; initPoint: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const notificationUrl = `${appUrl}/api/webhooks/mercadopago`;

  const body = {
    items: [
      {
        title: `${input.planName} — Ativação do site`,
        quantity: 1,
        unit_price: input.activationAmountCents / 100,
        currency_id: "BRL",
      },
    ],
    payer: {
      email: input.email,
      name: input.name || undefined,
    },
    external_reference: `act_${input.tenantId}`,
    metadata: {
      tenant_id: input.tenantId,
      plan_id: input.planId,
      type: "activation",
    },
    back_urls: {
      success: `${appUrl}/painel/assinatura?sucesso=1`,
      failure: `${appUrl}/painel/assinatura`,
      pending: `${appUrl}/painel/assinatura`,
    },
    auto_return: "approved",
    notification_url: notificationUrl,
    statement_descriptor: "SITE DOTERRA",
  };

  const pref = await mpFetch<{
    id: string;
    init_point?: string | null;
    sandbox_init_point?: string | null;
  }>("/checkout/preferences", { method: "POST", body: JSON.stringify(body) });

  const sandbox = process.env.MERCADOPAGO_SANDBOX === "true";
  const initPoint = sandbox ? pref.sandbox_init_point : pref.init_point;
  if (!initPoint) throw new Error("Mercado Pago não retornou um init_point");

  return { id: pref.id, initPoint };
}

// ============================ RECORRÊNCIA ============================

/**
 * Garante a existência de um plano recorrente no MP para a mensalidade ATUAL
 * do plano (fonte = tabela `plans`). Reutiliza o plano se o valor não mudou;
 * caso o Super Admin tenha alterado a mensalidade, cria um novo plano (o
 * snapshot da assinatura preserva o preço dos contratos existentes).
 */
export async function ensureRecurringPlan(
  planId: string
): Promise<{ id: string; amountCents: number }> {
  const admin = createAdminClient();
  const plan = await getPlanById(planId);
  if (!plan) throw new Error("Plano não encontrado");
  const amountCents = plan.monthly_price_cents;
  if (amountCents <= 0) throw new Error("Plano sem mensalidade configurada");

  if (plan.mercadopago_plan_id && plan.mercadopago_plan_amount_cents === amountCents) {
    return { id: plan.mercadopago_plan_id, amountCents };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const created = await mpFetch<{ id: string }>("/v1/plans", {
    method: "POST",
    body: JSON.stringify({
      reason: `Mensalidade — ${plan.name}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amountCents / 100,
        currency_id: "BRL",
      },
      external_reference: `plan_${plan.id}`,
      back_url: `${appUrl}/painel/assinatura`,
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
    }),
  });

  await admin
    .from("plans")
    .update({ mercadopago_plan_id: created.id, mercadopago_plan_amount_cents: amountCents })
    .eq("id", plan.id);

  return { id: created.id, amountCents };
}

/**
 * Cria a assinatura recorrente no MP com a PRIMEIRA COBRANÇA apenas após o
 * período definido pelo Super Admin (trial_months em /admin/planos).
 * `start_date` futura adia a primeira cobrança; `external_reference` =
 * "sub_<tenantId>" identifica os pagamentos recorrentes no webhook.
 */
export async function createRecurringSubscriptionMp(input: {
  planId: string;
  tenantId: string;
  email: string;
  monthlyAmountCents: number;
  trialEnd: string;
}): Promise<MpSubscription> {
  const { id: planIdMp } = await ensureRecurringPlan(input.planId);
  const trialDate = new Date(input.trialEnd);
  const billingDay = Math.min(Math.max(trialDate.getDate(), 1), 28);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return mpFetch<MpSubscription>("/v1/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planIdMp,
      payer: { email: input.email },
      external_reference: `sub_${input.tenantId}`,
      start_date: trialDate.toISOString(),
      billing_day: billingDay,
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
    }),
  });
}

export function getMpPayment(id: string): Promise<MpPayment> {
  return mpFetch<MpPayment>(`/v1/payments/${id}`);
}

export function getMpSubscription(id: string): Promise<MpSubscription> {
  return mpFetch<MpSubscription>(`/v1/subscriptions/${id}`);
}

/** Pausa a assinatura (usada no cancelamento: para as cobranças, mantém o registro). */
export async function pauseMpSubscription(id: string): Promise<MpSubscription> {
  return mpFetch<MpSubscription>(`/v1/subscriptions/${id}/pause`, {
    method: "POST",
    body: JSON.stringify({ status: "paused" }),
  });
}

/** Reativa (retoma cobranças) uma assinatura pausada. */
export async function resumeMpSubscription(id: string): Promise<MpSubscription> {
  return mpFetch<MpSubscription>(`/v1/subscriptions/${id}/authorize_payment`, {
    method: "POST",
    body: JSON.stringify({ status: "authorized" }),
  });
}

/** Cancela definitivamente a assinatura no MP. */
export async function cancelMpSubscription(id: string): Promise<MpSubscription> {
  return mpFetch<MpSubscription>(`/v1/subscriptions/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ status: "cancelled" }),
  });
}

// ============================ VALIDAÇÃO DE WEBHOOK ============================

/**
 * Valida a assinatura do webhook (x-signature: ts=...,v1=...).
 * Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>`
 * HMAC-SHA256 com a Access Token (ou MERCADOPAGO_WEBHOOK_SECRET, se configurada).
 */
export function verifyMpSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
}): boolean {
  if (!input.xSignature) return false;
  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of input.xSignature.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }
  if (!ts || !v1) return false;

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET || getMercadoPagoAccessToken();
  const manifest = `id:${input.dataId};request-id:${input.xRequestId || ""};ts:${ts}`;
  const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return hash === v1;
}

/** Adiciona trial_months meses à data atual (primeira cobrança da mensalidade). */
export function computeTrialEnd(months: number): Date {
  return addMonths(new Date(), Math.max(1, months));
}