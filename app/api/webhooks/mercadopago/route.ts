import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activateTenant } from "@/lib/billing";
import { getActiveOffer, getPlanById } from "@/lib/commercial";
import { registerAffiliateConversionForVisitor } from "@/lib/affiliate";
import { applyAffiliateCredit, releaseAffiliateCredit } from "@/lib/affiliate-credit";
import { extendSubscriptionPeriod } from "@/lib/checkout-quote";
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
 *   - "sub_<tenantId>" → cobrança recorrente da mensalidade;
 *   - "mon_<tenantId>" → mensalidade avulsa paga manualmente (com ou sem crédito).
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
    // Pagamento recusado/cancelado com crédito reservado: libera a reserva
    // para o saldo voltar ao afiliado (vale para act_ e mon_).
    if (payment.status === "rejected" || payment.status === "cancelled") {
      const usageId = (payment.metadata?.credit_usage_id as string | undefined) || null;
      if (usageId) await releaseAffiliateCredit(usageId);
      if (ref.startsWith("sub_")) return handleRecurringPayment(payment);
      return;
    }
    if (ref.startsWith("act_")) return handleActivationPayment(payment);
    if (ref.startsWith("mon_")) return handleManualMonthlyPayment(payment);
    if (ref.startsWith("sub_")) return handleRecurringPayment(payment);
    // Fallback: metadata da preference
    if (payment.metadata?.type === "activation") return handleActivationPayment(payment);
    if (payment.metadata?.type === "subscription") return handleManualMonthlyPayment(payment);
    return;
  }
  if (type === "subscription") {
    return handleSubscriptionUpdate(dataId);
  }
}

// ============================ ATIVAÇÃO PAGA ============================

/**
 * Reconcilia a linha "pending" criada no `/api/checkout` com o pagamento
 * aprovado no Mercado Pago — em vez de inserir uma SEGUNDA linha (que
 * deixava um "pendente" fantasma em /painel/pagamentos mesmo após o sucesso).
 *
 * 1) Idempotência: se já existe linha com este `mercadopago_payment_id`,
 *    reaproveita (webhook entregue 2x não duplica).
 * 2) Senão, reaproveita a pending da mesma tentativa — primeiro pela
 *    preferência (fluxo Checkout Pro/link), senão a pending mais recente
 *    do tipo (fluxo Brick dentro do site) — marcando-a como `succeeded`.
 * 3) Outras pendings órfãs da mesma cobrança → `cancelled` (nunca exibe
 *    "pendente" após o sucesso).
 * 4) Sem pending (recorrência, p.ex.) → insere a linha de sucesso.
 */
async function reconcileSucceededPayment(
  admin: ReturnType<typeof createAdminClient>,
  opts: {
    tenantId: string;
    type: "activation" | "subscription";
    subscriptionId?: string | null;
    payment: MpPayment;
    amountCents: number;
    paidAt: string;
    metadata: Record<string, unknown>;
  }
): Promise<string | null> {
  const mpId = String(opts.payment.id);

  // 1) Idempotência pelo id do pagamento no MP.
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("mercadopago_payment_id", mpId)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

  // 2) Pending da mesma tentativa.
  const { data: pendings } = await admin
    .from("payments")
    .select("id, metadata")
    .eq("tenant_id", opts.tenantId)
    .eq("type", opts.type)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  const list = (pendings as { id: string; metadata: any }[] | null) || [];
  const prefId = opts.payment.preference_id || null;
  const match = prefId
    ? list.find((p) => p?.metadata?.preference_id === prefId) || list[0] || null
    : list[0] || null;

  const succeededFields: Record<string, unknown> = {
    ...(opts.subscriptionId ? { subscription_id: opts.subscriptionId } : {}),
    mercadopago_payment_id: mpId,
    ...(prefId ? { mercadopago_preference_id: prefId } : {}),
    type: opts.type,
    amount_cents: opts.amountCents,
    currency: (opts.payment.currency_id || "brl").toLowerCase(),
    status: "succeeded",
    paid_at: opts.paidAt,
  };

  if (match) {
    const mergedMeta = { ...((match.metadata as Record<string, unknown>) || {}), ...opts.metadata };
    const { data } = await admin
      .from("payments")
      .update({ ...succeededFields, metadata: mergedMeta })
      .eq("id", match.id)
      .select("id")
      .maybeSingle();
    // 3) Pendings órfãs da mesma cobrança → canceladas.
    await admin
      .from("payments")
      .update({ status: "cancelled" })
      .eq("tenant_id", opts.tenantId)
      .eq("type", opts.type)
      .eq("status", "pending")
      .neq("id", match.id);
    return (data as { id: string } | null)?.id || match.id;
  }

  // 4) Sem pending — insere a linha de sucesso.
  const { data: inserted } = await admin
    .from("payments")
    .insert({ tenant_id: opts.tenantId, ...succeededFields, metadata: opts.metadata })
    .select("id")
    .maybeSingle();
  return (inserted as { id: string } | null)?.id || null;
}

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
  const creditUsageId = (payment.metadata?.credit_usage_id as string | undefined) || null;

  // Registra o pagamento de ativação reconciliando a linha "pending" do
  // checkout (sem duplicar e sem deixar "pendente" fantasma no painel).
  const paidAt = payment.date_approved
    ? new Date(payment.date_approved).toISOString()
    : new Date().toISOString();
  const paymentRowId = await reconcileSucceededPayment(admin, {
    tenantId,
    type: "activation",
    payment,
    amountCents,
    paidAt,
    metadata: {
      plan_id: planId,
      gateway: "mercadopago",
      external_reference: ref,
      ...(creditUsageId ? { credit_usage_id: creditUsageId } : {}),
      ...(typeof payment.metadata?.credit_applied_cents !== "undefined"
        ? { credit_applied_cents: payment.metadata.credit_applied_cents }
        : {}),
      ...(typeof payment.metadata?.original_amount_cents !== "undefined"
        ? { original_amount_cents: payment.metadata.original_amount_cents }
        : {}),
    },
  });

  // Crédito de afiliado: confirma a utilização SOMENTE com pagamento aprovado.
  if (creditUsageId) {
    const applied = await applyAffiliateCredit(creditUsageId, paymentRowId);
    if (!applied) {
      console.error("[mercadopago webhook] falha ao confirmar crédito de afiliado", {
        usage_id: creditUsageId,
        mp_payment_id: payment.id,
      });
    }
  }

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

  await auditPaymentEvent("user.site_activated_payment", tenant.user_id, tenantId, {
    gateway: "mercadopago",
    amount_cents: amountCents,
  });

  // ---- Atribuição de afiliado ----
  // Se a preferência foi criada com `metadata.visitor_token` (link de
  // afiliado), o pagamento carrega esse mesmo token no `metadata`. Aqui
  // registramos a conversão para que o afiliado responsável receba a
  // comissão (first-click wins — função SQL `register_affiliate_conversion`).
  const visitorToken = (payment.metadata?.visitor_token as string | undefined) || null;
  if (visitorToken && tenant.user_id) {
    try {
      await registerAffiliateConversionForVisitor({
        visitorToken,
        newCustomerUserId: tenant.user_id,
        saleAmountCents: amountCents,
      });
    } catch (convErr) {
      console.error("[mercadopago webhook] falha ao registrar conversão de afiliado", convErr);
    }
  }
}

// ============================ MENSALIDADE AVULSA (PAGAMENTO MANUAL) ============================

// Mensalidade paga manualmente pelo /checkout (type = subscription), com ou
// sem crédito de afiliado. Diferente da recorrência automática do gateway
// (handleRecurringPayment), aqui o período é estendido em +1 mês.
async function handleManualMonthlyPayment(payment: MpPayment) {
  if (payment.status !== "approved") return;

  const admin = createAdminClient();
  const ref = payment.external_reference || "";
  const tenantId = ref.startsWith("mon_")
    ? ref.slice(4)
    : (payment.metadata?.tenant_id as string | undefined);
  if (!tenantId) return;

  const metaSubId = (payment.metadata?.subscription_id as string | undefined) || null;
  let sub: { id: string } | null = null;
  if (metaSubId) {
    const { data } = await admin
      .from("subscriptions")
      .select("id")
      .eq("id", metaSubId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    sub = (data as { id: string } | null) || null;
  }
  if (!sub) {
    const { data } = await admin
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sub = (data as { id: string } | null) || null;
  }
  if (!sub) {
    console.error("[mercadopago webhook] mensalidade avulsa sem assinatura", { tenantId });
    return;
  }

  const amountCents = Math.round((payment.transaction_amount || 0) * 100);
  const creditUsageId = (payment.metadata?.credit_usage_id as string | undefined) || null;

  const paidAt = payment.date_approved
    ? new Date(payment.date_approved).toISOString()
    : new Date().toISOString();
  const paymentRowId = await reconcileSucceededPayment(admin, {
    tenantId,
    type: "subscription",
    subscriptionId: sub.id,
    payment,
    amountCents,
    paidAt,
    metadata: {
      gateway: "mercadopago",
      external_reference: ref,
      manual_monthly: true,
      ...(creditUsageId ? { credit_usage_id: creditUsageId } : {}),
      ...(typeof payment.metadata?.credit_applied_cents !== "undefined"
        ? { credit_applied_cents: payment.metadata.credit_applied_cents }
        : {}),
      ...(typeof payment.metadata?.original_amount_cents !== "undefined"
        ? { original_amount_cents: payment.metadata.original_amount_cents }
        : {}),
    },
  });

  const periodStart = new Date().toISOString();
  await admin.from("billing_history").upsert(
    {
      tenant_id: tenantId,
      subscription_id: sub.id,
      mercadopago_payment_id: String(payment.id),
      type: "subscription",
      amount_cents: amountCents,
      currency: "brl",
      status: "succeeded",
      period_start: periodStart,
    },
    { onConflict: "mercadopago_payment_id" }
  );

  try {
    await extendSubscriptionPeriod(admin, tenantId, sub.id);
  } catch (e) {
    console.error("[mercadopago webhook] falha ao estender assinatura", e);
  }

  if (creditUsageId) {
    const applied = await applyAffiliateCredit(creditUsageId, paymentRowId);
    if (!applied) {
      console.error("[mercadopago webhook] falha ao confirmar crédito de afiliado", {
        usage_id: creditUsageId,
        mp_payment_id: payment.id,
      });
    }
  }

  await activateTenant(tenantId);

  const { data: tOwner } = await admin.from("tenants").select("user_id").eq("id", tenantId).maybeSingle();
  if (tOwner?.user_id) {
    await auditPaymentEvent("user.site_reactivated_payment", tOwner.user_id, tenantId, {
      gateway: "mercadopago",
      amount_cents: amountCents,
      manual_monthly: true,
    });
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

    const { data: tOwner } = await admin.from("tenants").select("user_id").eq("id", tenantId).maybeSingle();
    if (tOwner?.user_id) {
      await auditPaymentEvent("user.site_reactivated_payment", tOwner.user_id, tenantId, {
        gateway: "mercadopago",
        amount_cents: amountCents,
      });
    }
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
      const { data: tOwner } = await admin.from("tenants").select("user_id").eq("id", tenantId).maybeSingle();
      if (tOwner?.user_id) {
        await auditPaymentEvent("user.site_suspended_past_due", tOwner.user_id, tenantId, {
          gateway: "mercadopago",
        });
      }
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
      const { data: tOwner } = await admin.from("tenants").select("user_id").eq("id", tenantId).maybeSingle();
      if (tOwner?.user_id) {
        await auditPaymentEvent("user.site_suspended_billing", tOwner.user_id, tenantId, {
          gateway: "mercadopago",
          mp_status: mpSub.status,
        });
      }
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

/**
 * Histórico de ativações/suspensões por pagamento (best-effort: nunca quebra
 * o webhook). actor = dono da conta; via identifica o gateway.
 */
async function auditPaymentEvent(
  action: string,
  userId: string,
  tenantId: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      actor_id: userId,
      actor_role: "user",
      action,
      entity_type: "profile",
      entity_id: userId,
      metadata: { tenant_id: tenantId, via: "webhook_mp", ...metadata },
    });
  } catch {}
}