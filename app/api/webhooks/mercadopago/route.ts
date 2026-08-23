import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activateTenant } from "@/lib/billing";
import { getActiveOffer, getPlanById } from "@/lib/commercial";
import {
  createRecurringSubscriptionMp,
  getMpPayment,
  getMpSubscription,
  isMercadoPagoEnabled,
  verifyMpSignature,
  type MpPayment,
} from "@/lib/mercadopago";

export const runtime = "nodejs";

/**
 * Webhook do Mercado Pago — FONTE PRINCIPAL de atualização do status financeiro
 * para pagamentos feitos por este gateway (o frontend nunca é fonte de verdade).
 *
 * Notificações: JSON { type: "payment" | "subscription", data: { id }, action }.
 * Idempotência: mesmo padrão do Stripe, via tabela `payment_events`
 * (event_id = `mp_<action>_<data.id>`).
 *
 * Mapa de identificação via `external_reference`:
 *   - "act_<tenantId>" → pagamento ÚNICO de ativação;
 *   - "sub_<tenantId>" → cobrança recorrente da mensalidade.
 */
export async function POST(request: Request) {
  if (!(await isMercadoPagoEnabled())) {
    return NextResponse.json({ error: "Mercado Pago não configurado" }, { status: 500 });
  }

  const bodyText = await request.text();
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  const admin = createAdminClient();

  let type: string | null = null;
  let dataId: string | null = null;
  let action: string | null = null;

  // Payload novo (JSON) ou legado (form-urlencoded)
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed && typeof parsed === "object") {
      type = parsed.type || null;
      dataId = parsed.data?.id != null ? String(parsed.data.id) : null;
      action = parsed.action || null;
    }
  } catch {
    // corpo não é JSON → tenta form-urlencoded
  }

  if (!type || !dataId) {
    const params = new URLSearchParams(bodyText);
    type = params.get("type") || params.get("topic");
    dataId = params.get("data.id") || params.get("id");
  }
  if (!type || !dataId) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  if (!(await verifyMpSignature({ xSignature, xRequestId, dataId }))) {
    console.warn("Mercado Pago webhook: assinatura inválida", { xSignature, xRequestId, dataId });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const eventId = `mp_${action || type}_${dataId}`;

  // ---- Idempotência ----
  const { data: inserted, error: insertErr } = await admin
    .from("payment_events")
    .insert({
      gateway: "mercadopago",
      stripe_event_id: eventId,
      stripe_event_type: action || type,
      data: { type, data_id: dataId, action },
    })
    .select("processed_at")
    .maybeSingle();

  const processedAt = inserted?.processed_at || null;

  if (insertErr) {
    const isDup =
      String(insertErr.message).toLowerCase().includes("duplicate") ||
      String(insertErr.message).toLowerCase().includes("unique");
    if (isDup) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Falha ao registrar evento do MP", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  try {
    await handleNotification(type, dataId);
  } catch (err) {
    await admin.from("payment_events").delete().eq("stripe_event_id", eventId);
    console.error("Mercado Pago webhook: erro ao processar", type, dataId, err);
    return NextResponse.json({ error: "processing_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ============================ DISPATCH ============================

async function handleNotification(type: string, dataId: string) {
  if (type === "payment") {
    const payment = await getMpPayment(dataId);
    const ref = payment.external_reference || "";
    if (ref.startsWith("act_")) return handleActivationPayment(payment);
    if (ref.startsWith("sub_")) return handleRecurringPayment(payment);
    // Fallback: metadata da preference
    if (payment.metadata?.type === "activation") return handleActivationPayment(payment);
    return;
  }
  if (type === "subscription") {
    return handleSubscriptionUpdate(dataId);
  }
}

// ============================ ATIVAÇÃO PAGA ============================

async function handleActivationPayment(payment: MpPayment) {
  if (payment.status !== "approved") return;

  const admin = createAdminClient();
  const ref = payment.external_reference || "";
  const tenantId = ref.startsWith("act_")
    ? ref.slice(4)
    : (payment.metadata?.tenant_id as string | undefined);
  if (!tenantId) return;

  const { data: tenant } = await admin.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return;
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", tenant.user_id)
    .single();

  const planId = (payment.metadata?.plan_id as string | undefined) || null;
  const plan = planId ? await getPlanById(planId) : await getActiveOffer();

  const amountCents = Math.round((payment.transaction_amount || 0) * 100);

  // Registra o pagamento de ativação (idempotente: upsert pelo id do MP)
  await admin.from("payments").upsert(
    {
      tenant_id: tenantId,
      mercadopago_payment_id: String(payment.id),
      mercadopago_preference_id: payment.preference_id || null,
      type: "activation",
      amount_cents: amountCents,
      currency: (payment.currency_id || "brl").toLowerCase(),
      status: "succeeded",
      paid_at: payment.date_approved ? new Date(payment.date_approved).toISOString() : new Date().toISOString(),
      metadata: { plan_id: planId, gateway: "mercadopago", external_reference: ref },
    },
    { onConflict: "mercadopago_payment_id" }
  );

  await admin.from("billing_history").upsert(
    {
      tenant_id: tenantId,
      plan_id: planId || null,
      mercadopago_payment_id: String(payment.id),
      type: "activation",
      amount_cents: amountCents,
      currency: "brl",
      status: "succeeded",
    },
    { onConflict: "mercadopago_payment_id" }
  );

  // Evita assinaturas duplicadas
  const { data: existingActive } = await admin
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  const { data: tenantRow } = await admin
    .from("tenants")
    .select("monthly_billing_enabled")
    .eq("id", tenantId)
    .maybeSingle();
  const billingEnabled = tenantRow?.monthly_billing_enabled !== false;

  if (!existingActive && billingEnabled && plan) {
    const trialMonths = Math.max(1, plan.trial_months || 3);
    const trialEnd = new Date();
    trialEnd.setMonth(trialEnd.getMonth() + trialMonths);
    const monthlyAmountCents = plan.monthly_price_cents;

    const mpSub = await createRecurringSubscriptionMp({
      planId: plan.id,
      tenantId,
      email: profile?.email || "",
      monthlyAmountCents,
      trialEnd: trialEnd.toISOString(),
    });

    await admin.from("subscriptions").insert({
      tenant_id: tenantId,
      plan_id: plan.id,
      gateway: "mercadopago",
      mercadopago_subscription_id: mpSub.id,
      mercadopago_plan_id: mpSub.plan_id || null,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd.toISOString(),
      next_billing_at: trialEnd.toISOString(),
      trial_end: trialEnd.toISOString(),
      activated_at: new Date().toISOString(),
      // CONTRATO CONGELADO: mudanças futuras de preço em /admin/planos
      // não afetam este contrato (fonte de valores para o painel do usuário).
      snapshot: {
        gateway: "mercadopago",
        plan_id: plan.id,
        currency: "brl",
        activation_amount_cents: plan.activation_price_cents,
        monthly_amount_cents: monthlyAmountCents,
        trial_months: trialMonths,
        trial_period_days: trialMonths * 30,
      },
    });
  }

  // Usuário isento de mensalidade: ativa sem criar assinatura recorrente.
  if (!billingEnabled) {
    await admin
      .from("tenants")
      .update({ site_status: "active", suspended_at: null, activated_at: new Date().toISOString() })
      .eq("id", tenantId);
    await admin
      .from("profiles")
      .update({ status: "active", activated_at: new Date().toISOString() })
      .eq("user_id", tenant.user_id);
  } else {
    await activateTenant(tenantId, tenant.user_id);
  }
}

// ============================ COBRANÇA RECORRENTE (MENSALIDADE) ============================

async function handleRecurringPayment(payment: MpPayment) {
  const admin = createAdminClient();
  const ref = payment.external_reference || "";
  const tenantId = ref.startsWith("sub_") ? ref.slice(4) : null;
  if (!tenantId) return;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("gateway", "mercadopago")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return;

  if (payment.status === "approved") {
    let nextBilling: string | null = sub.next_billing_at;
    try {
      const mpSub = await getMpSubscription(sub.mercadopago_subscription_id);
      if (mpSub?.next_payment_date) nextBilling = new Date(mpSub.next_payment_date).toISOString();
    } catch {
      // assinatura pode não existir mais; mantém o valor atual
    }

    await admin
      .from("subscriptions")
      .update({
        status: "active",
        cancel_at_period_end: false,
        canceled_at: null,
        current_period_start: payment.date_approved
          ? new Date(payment.date_approved).toISOString()
          : sub.current_period_start,
        current_period_end: nextBilling,
        next_billing_at: nextBilling,
      })
      .eq("id", sub.id);

    const amountCents = Math.round((payment.transaction_amount || 0) * 100);

    await admin.from("payments").upsert(
      {
        tenant_id: tenantId,
        subscription_id: sub.id,
        mercadopago_payment_id: String(payment.id),
        type: "subscription",
        amount_cents: amountCents,
        currency: (payment.currency_id || "brl").toLowerCase(),
        status: "succeeded",
        paid_at: payment.date_approved ? new Date(payment.date_approved).toISOString() : new Date().toISOString(),
        metadata: { gateway: "mercadopago", external_reference: ref },
      },
      { onConflict: "mercadopago_payment_id" }
    );

    await admin.from("billing_history").upsert(
      {
        tenant_id: tenantId,
        subscription_id: sub.id,
        plan_id: sub.plan_id,
        mercadopago_payment_id: String(payment.id),
        type: "subscription",
        amount_cents: amountCents,
        currency: "brl",
        status: "succeeded",
        period_start: sub.current_period_start,
        period_end: nextBilling,
      },
      { onConflict: "mercadopago_payment_id" }
    );

    await activateTenant(tenantId);
  } else if (payment.status === "rejected" || payment.status === "cancelled") {
    const { data: tenantRow } = await admin
      .from("tenants")
      .select("monthly_billing_enabled")
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantRow?.monthly_billing_enabled !== false) {
      await admin.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
      await admin
        .from("tenants")
        .update({ site_status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", tenantId);
    }
  }
  // status "pending"/"in_process" (ex.: PIX aguardando) → aguarda confirmação
}

// ============================ ATUALIZAÇÃO DE ASSINATURA ============================

async function handleSubscriptionUpdate(subscriptionId: string) {
  const admin = createAdminClient();
  const mpSub = await getMpSubscription(subscriptionId);
  if (!mpSub) return;

  const ref = mpSub.external_reference || "";
  const tenantId = ref.startsWith("sub_") ? ref.slice(4) : null;
  if (!tenantId) return;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("gateway", "mercadopago")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return;

  const status = mapMpSubStatus(mpSub.status);
  const payload: Record<string, unknown> = { status };
  if (mpSub.plan_id) payload.mercadopago_plan_id = mpSub.plan_id;
  if (mpSub.next_payment_date) payload.next_billing_at = new Date(mpSub.next_payment_date).toISOString();
  await admin.from("subscriptions").update(payload).eq("id", sub.id);

  const { data: tenantRow } = await admin
    .from("tenants")
    .select("monthly_billing_enabled")
    .eq("id", tenantId)
    .maybeSingle();
  const billingEnabled = tenantRow?.monthly_billing_enabled !== false;

  if (
    mpSub.status === "cancelled" ||
    mpSub.status === "donated" ||
    mpSub.status === "finished"
  ) {
    // Inadimplência encerrada / cancelada pelo MP sem agendamento do usuário → suspende.
    // (Cancelamento agendado pelo usuário = pause: o site segue público até o fim do
    // período pago — finalização preguiçosa em getDashboardContext.)
    if (billingEnabled && !sub.cancel_at_period_end) {
      await admin
        .from("tenants")
        .update({ site_status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", tenantId);
    }
  } else if (mpSub.status === "authorized" || mpSub.status === "charged" || mpSub.status === "pending") {
    await activateTenant(tenantId);
  }
  // "paused" / "pending_payment" / "in_arrears": inadimplência em retry é tratada
  // pelos webhooks de pagamento (payment.rejected → past_due + suspensão).
}

function mapMpSubStatus(status: string): string {
  switch (status) {
    case "authorized":
    case "charged":
    case "pending":
      return "active";
    case "in_arrears":
    case "pending_payment":
    case "error":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "paused":
      return "paused";
    case "cancelled":
    case "donated":
    case "finished":
      return "canceled";
    default:
      return "active";
  }
}