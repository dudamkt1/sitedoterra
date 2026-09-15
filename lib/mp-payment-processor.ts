import { createAdminClient } from "@/lib/supabase/admin";
import { activateTenant, deactivateTenant } from "@/lib/billing";
import { getActiveOffer, getPlanById } from "@/lib/commercial";
import { registerAffiliateConversionForVisitor } from "@/lib/affiliate";
import { applyAffiliateCredit, releaseAffiliateCredit } from "@/lib/affiliate-credit";
import { extendSubscriptionPeriod } from "@/lib/checkout-quote";
import {
  cancelMpSubscription,
  createRecurringSubscriptionMp,
  getMpSubscription,
  type MpPayment,
} from "@/lib/mercadopago";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * PROCESSADOR COMPARTILHADO DE PAGAMENTOS DO MERCADO PAGO.
 *
 * O Mercado Pago é a FONTE DE VERDADE: tanto o webhook
 * (`/api/webhooks/mercadopago`) quanto a sincronização manual
 * (`POST /api/payments/sync`, disparada pelo botão "Verificar pagamento")
 * consultam o pagamento na API do MP e aplicam a MESMA máquina de estados
 * aqui — nunca confiam no frontend, em retorno de URL ou em e-mail.
 *
 * Mapa de status MP → interno (coluna `payments.status`):
 *   approved              → succeeded + ativa/regulariza o serviço
 *   pending/in_process/
 *   in_mediation/authorized → pending (aguarda; NÃO ativa)
 *   rejected/cancelled    → failed (NÃO ativa; libera crédito reservado)
 *   refunded/charged_back → refunded (histórico preservado; desativa o
 *                           serviço daquela ativação; permite novo pagamento)
 */

// ============================ RECONCILIAÇÃO ============================

/**
 * Reconcilia a linha "pending" criada no `/api/checkout` com o pagamento
 * aprovado no Mercado Pago — em vez de inserir uma SEGUNDA linha (que
 * deixava um "pendente" fantasma em /painel/pagamentos mesmo após o sucesso).
 *
 * 1) Idempotência: se já existe linha com este `mercadopago_payment_id`,
 *    reaproveita (webhook/sync entregues 2x não duplicam).
 * 2) Senão, reaproveita a pending da mesma tentativa — primeiro pela
 *    preferência (fluxo Checkout Pro/link), senão a pending mais recente
 *    do tipo (fluxo Brick dentro do site) — marcando-a como `succeeded`.
 * 3) Outras pendings órfãs da mesma cobrança → `cancelled` (nunca exibe
 *    "pendente" após o sucesso).
 * 4) Sem pending (recorrência, p.ex.) → insere a linha de sucesso.
 *
 * Retorna o id da linha + o status final (se já estava `refunded` — approved
 * chegando fora de ordem — o reembolso prevalece e quem chamou NÃO ativa).
 */
export async function reconcileSucceededPayment(
  admin: Admin,
  opts: {
    tenantId: string;
    type: "activation" | "subscription";
    subscriptionId?: string | null;
    payment: MpPayment;
    amountCents: number;
    paidAt: string;
    metadata: Record<string, unknown>;
  }
): Promise<{ id: string | null; status: string }> {
  const mpId = String(opts.payment.id);

  // 1) Idempotência pelo id do pagamento no MP.
  const { data: existing } = await admin
    .from("payments")
    .select("id, status")
    .eq("mercadopago_payment_id", mpId)
    .maybeSingle();
  const ex = existing as { id: string; status: string } | null;
  if (ex) return { id: ex.id, status: ex.status };

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
    return { id: (data as { id: string } | null)?.id || match.id, status: "succeeded" };
  }

  // 4) Sem pending — insere a linha de sucesso.
  const { data: inserted } = await admin
    .from("payments")
    .insert({ tenant_id: opts.tenantId, ...succeededFields, metadata: opts.metadata })
    .select("id")
    .maybeSingle();
  return { id: (inserted as { id: string } | null)?.id || null, status: "succeeded" };
}

/**
 * Pagamento recusado/cancelado: a pending da tentativa vira `failed`
 * (nunca "pendente" eterno) e a reserva de crédito de afiliado é liberada.
 */
async function markPaymentFailed(
  admin: Admin,
  opts: { tenantId: string; type: "activation" | "subscription"; payment: MpPayment }
): Promise<void> {
  const prefId = opts.payment.preference_id || null;
  const { data: pendings } = await admin
    .from("payments")
    .select("id, metadata")
    .eq("tenant_id", opts.tenantId)
    .eq("type", opts.type)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  const list = (pendings as { id: string; metadata: any }[] | null) || [];
  const match = prefId
    ? list.find((p) => p?.metadata?.preference_id === prefId) || list[0] || null
    : list[0] || null;
  if (match) {
    await admin
      .from("payments")
      .update({
        status: "failed",
        metadata: {
          ...((match.metadata as Record<string, unknown>) || {}),
          mp_status: opts.payment.status,
          failed_at: new Date().toISOString(),
        },
      })
      .eq("id", match.id);
  }
  const usageId =
    ((match?.metadata as Record<string, unknown> | undefined)?.credit_usage_id as string | undefined) ||
    (opts.payment.metadata?.credit_usage_id as string | undefined) ||
    null;
  if (usageId) await releaseAffiliateCredit(usageId);
}

// ============================ VALIDAÇÃO DE VALOR ============================

/**
 * Confere o valor pago no MP contra o total esperado gravado na criação
 * (`expected_total_cents` — desconto PIX + crédito já aplicados no backend).
 * Tolerância de 1 centavo (arredondamento). Divergência NÃO bloqueia a
 * ativação (evita travar usuário legítimo), mas é auditada e sinalizada.
 */
function checkPaidAmount(
  payment: MpPayment,
  amountCents: number
): { ok: boolean; expected: number | null } {
  const expected = Number(payment.metadata?.expected_total_cents);
  if (!Number.isFinite(expected) || expected <= 0) return { ok: true, expected: null };
  return { ok: Math.abs(amountCents - Math.round(expected)) <= 1, expected: Math.round(expected) };
}

async function auditAmountMismatch(
  admin: Admin,
  opts: { userId: string; tenantId: string; payment: MpPayment; amountCents: number; expected: number }
) {
  console.error("[mp] valor pago diverge do esperado", {
    tenant_id: opts.tenantId,
    mp_payment_id: opts.payment.id,
    paid_cents: opts.amountCents,
    expected_cents: opts.expected,
  });
  try {
    await admin.from("audit_logs").insert({
      actor_id: opts.userId,
      actor_role: "system",
      action: "payment.amount_mismatch",
      entity_type: "profile",
      entity_id: opts.userId,
      metadata: {
        tenant_id: opts.tenantId,
        via: "webhook_mp",
        mp_payment_id: String(opts.payment.id),
        paid_cents: opts.amountCents,
        expected_cents: opts.expected,
      },
    });
  } catch {}
}

// ============================ TENANT DO PAGAMENTO ============================

function tenantIdFromPayment(payment: MpPayment): string | null {
  const ref = payment.external_reference || "";
  if (ref.startsWith("act_")) return ref.slice(4);
  if (ref.startsWith("mon_")) return ref.slice(4);
  if (ref.startsWith("sub_")) return ref.slice(4);
  return (payment.metadata?.tenant_id as string | undefined) || null;
}

// ============================ DISPATCH (FONTE DE VERDADE) ============================

/**
 * Aplica o estado real do pagamento (já consultado na API do MP).
 * Idempotente: pode ser chamado pelo webhook e pelo sync, várias vezes.
 */
export async function dispatchMpPayment(payment: MpPayment): Promise<{ handled: boolean; status: string }> {
  const status = String(payment.status || "");
  if (status === "approved") {
    const ref = payment.external_reference || "";
    if (ref.startsWith("act_")) {
      await handleActivationPayment(payment);
      return { handled: true, status };
    }
    if (ref.startsWith("mon_")) {
      await handleManualMonthlyPayment(payment);
      return { handled: true, status };
    }
    if (ref.startsWith("sub_")) {
      await handleRecurringPayment(payment);
      return { handled: true, status };
    }
    // Fallback: metadata da preference/pagamento.
    if (payment.metadata?.type === "activation") {
      await handleActivationPayment(payment);
      return { handled: true, status };
    }
    if (payment.metadata?.type === "subscription") {
      await handleManualMonthlyPayment(payment);
      return { handled: true, status };
    }
    return { handled: false, status };
  }

  if (status === "rejected" || status === "cancelled") {
    await handleRefusedPayment(payment);
    return { handled: true, status };
  }

  if (status === "refunded" || status === "charged_back") {
    await handleMpRefund(payment);
    return { handled: true, status };
  }

  // pending / in_process / in_mediation / authorized → aguarda confirmação.
  // Garante que exista uma linha pending rastreando a tentativa.
  await ensurePendingRow(payment);
  return { handled: true, status: status || "pending" };
}

/** Pagamento ainda não confirmado: garante linha `pending` para rastreio. */
async function ensurePendingRow(payment: MpPayment): Promise<void> {
  const tenantId = tenantIdFromPayment(payment);
  if (!tenantId) return;
  const ref = payment.external_reference || "";
  const type: "activation" | "subscription" = ref.startsWith("mon_") || ref.startsWith("sub_")
    ? "subscription"
    : "activation";
  const admin = createAdminClient();
  const mpId = String(payment.id);
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("mercadopago_payment_id", mpId)
    .maybeSingle();
  if (existing) return;
  const { data: pending } = await admin
    .from("payments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("type", type)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pending) return;
  await admin.from("payments").insert({
    tenant_id: tenantId,
    mercadopago_payment_id: mpId,
    mercadopago_preference_id: payment.preference_id || null,
    type,
    amount_cents: Math.round((payment.transaction_amount || 0) * 100),
    currency: (payment.currency_id || "brl").toLowerCase(),
    status: "pending",
    metadata: { gateway: "mercadopago", external_reference: ref, mp_status: payment.status },
  });
}

// ============================ RECUSADO / CANCELADO ============================

async function handleRefusedPayment(payment: MpPayment) {
  const tenantId = tenantIdFromPayment(payment);
  if (!tenantId) return;
  const admin = createAdminClient();
  const ref = payment.external_reference || "";
  // Recorrência: marca inadimplência + suspende (regra já existente).
  if (ref.startsWith("sub_")) {
    await handleRecurringPayment(payment);
    return;
  }
  const type: "activation" | "subscription" = ref.startsWith("mon_") ? "subscription" : "activation";
  await markPaymentFailed(admin, { tenantId, type, payment });
  const { data: tOwner } = await admin.from("tenants").select("user_id").eq("id", tenantId).maybeSingle();
  if (tOwner?.user_id) {
    await auditPaymentEvent("payment.refused", tOwner.user_id, tenantId, {
      gateway: "mercadopago",
      mp_payment_id: String(payment.id),
      mp_status: payment.status,
    });
  }
}

// ============================ ATIVAÇÃO APROVADA ============================

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

  // Validação de valor (§17): pago x esperado (desconto PIX + crédito).
  const amountCheck = checkPaidAmount(payment, amountCents);
  const mismatchMeta = !amountCheck.ok && amountCheck.expected != null
    ? { amount_mismatch: true, expected_total_cents: amountCheck.expected }
    : {};

  // Registra o pagamento de ativação reconciliando a linha "pending" do
  // checkout (sem duplicar e sem deixar "pendente" fantasma no painel).
  const paidAt = payment.date_approved
    ? new Date(payment.date_approved).toISOString()
    : new Date().toISOString();
  const { id: paymentRowId, status: rowStatus } = await reconcileSucceededPayment(admin, {
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
      ...mismatchMeta,
    },
  });

  // Reembolso (ou pedido de reembolso) chegou antes do approved (fora de
  // ordem): o reembolso prevalece — NÃO ativa o site.
  if (rowStatus === "refunded" || rowStatus === "refund_pending") {
    console.warn("[mp] approved ignorado: pagamento já em reembolso", { mp_payment_id: payment.id, rowStatus });
    return;
  }

  if (!amountCheck.ok && amountCheck.expected != null && tenant.user_id) {
    await auditAmountMismatch(admin, {
      userId: tenant.user_id,
      tenantId,
      payment,
      amountCents,
      expected: amountCheck.expected,
    });
  }

  // Crédito de afiliado: confirma a utilização SOMENTE com pagamento aprovado.
  if (creditUsageId) {
    const applied = await applyAffiliateCredit(creditUsageId, paymentRowId);
    if (!applied) {
      console.error("[mercadopago] falha ao confirmar crédito de afiliado", {
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
    // 3 meses sem mensalidade: primeira cobrança só após trial_months.
    const trialMonths = Math.max(1, plan.trial_months || 3);
    const trialEnd = new Date();
    trialEnd.setMonth(trialEnd.getMonth() + trialMonths);
    const monthlyAmountCents = plan.monthly_price_cents;

    try {
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
    } catch (subErr) {
      // A recorrência no MP NÃO pode travar a ativação: o pagamento já foi
      // aprovado (PAGO). Cria a assinatura local ativa (trial válido) para o
      // site ligar imediatamente; a cobrança futura segue manual até a
      // recorrência ser regularizada. Audita para o admin acompanhar.
      console.error("[mercadopago] falha ao criar recorrência — ativando com assinatura local", subErr);
      await admin.from("subscriptions").insert({
        tenant_id: tenantId,
        plan_id: plan.id,
        gateway: "mercadopago",
        mercadopago_subscription_id: null,
        mercadopago_plan_id: null,
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: trialEnd.toISOString(),
        next_billing_at: trialEnd.toISOString(),
        trial_end: trialEnd.toISOString(),
        activated_at: new Date().toISOString(),
        snapshot: {
          gateway: "mercadopago",
          plan_id: plan.id,
          currency: "brl",
          activation_amount_cents: plan.activation_price_cents,
          monthly_amount_cents: monthlyAmountCents,
          trial_months: trialMonths,
          trial_period_days: trialMonths * 30,
          mp_recurring_failed: true,
        },
      });
      try {
        await admin.from("audit_logs").insert({
          actor_id: tenant.user_id,
          actor_role: "system",
          action: "subscription.mp_recurring_failed",
          entity_type: "profile",
          entity_id: tenant.user_id,
          metadata: {
            tenant_id: tenantId,
            via: "webhook_mp",
            error: subErr instanceof Error ? subErr.message.slice(0, 300) : "recorrência MP falhou",
          },
        });
      } catch {}
    }
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
      console.error("[mercadopago] falha ao registrar conversão de afiliado", convErr);
    }
  }
}

// ============================ MENSALIDADE AVULSA APROVADA ============================

// Mensalidade paga manualmente pelo /checkout (type = subscription), com ou
// sem crédito de afiliado. Diferente da recorrência automática do gateway
// (handleRecurringPayment), aqui o período é estendido em +1 mês — nunca é
// criada nova assinatura nem duplicada a cobrança.
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
    console.error("[mercadopago] mensalidade avulsa sem assinatura", { tenantId });
    return;
  }

  const amountCents = Math.round((payment.transaction_amount || 0) * 100);
  const creditUsageId = (payment.metadata?.credit_usage_id as string | undefined) || null;

  const amountCheck = checkPaidAmount(payment, amountCents);
  const mismatchMeta = !amountCheck.ok && amountCheck.expected != null
    ? { amount_mismatch: true, expected_total_cents: amountCheck.expected }
    : {};

  const paidAt = payment.date_approved
    ? new Date(payment.date_approved).toISOString()
    : new Date().toISOString();
  const { id: paymentRowId, status: rowStatus } = await reconcileSucceededPayment(admin, {
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
      ...mismatchMeta,
    },
  });

  if (rowStatus === "refunded" || rowStatus === "refund_pending") {
    console.warn("[mp] approved ignorado: pagamento já em reembolso", { mp_payment_id: payment.id, rowStatus });
    return;
  }

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
    console.error("[mercadopago] falha ao estender assinatura", e);
  }

  if (creditUsageId) {
    const applied = await applyAffiliateCredit(creditUsageId, paymentRowId);
    if (!applied) {
      console.error("[mercadopago] falha ao confirmar crédito de afiliado", {
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

// ============================ REEMBOLSO / DEVOLUÇÃO ============================

/**
 * Pagamento devolvido/reembolsado (`refunded`) ou estornado via disputa
 * (`charged_back`):
 *   - pagamento → `refunded` (histórico PRESERVADO, nunca apagado);
 *   - data/valor da devolução registrados em metadata;
 *   - se era ativação → site DESATIVADO (conteúdo/usuário/config preservados;
 *     novo pagamento aprovado reativa e gera NOVO registro);
 *   - se era mensalidade → assinatura volta para `past_due` (fluxo normal
 *     de "mensalidade em aberto" já existente no painel);
 *   - recorrência → inadimplência + suspensão (mesma regra de recusado).
 */
/**
 * Exportado para a autorização manual do admin (`/api/admin/refunds/authorize`):
 * após o MP aceitar a devolução, a baixa é aplicada NA HORA (pagamento →
 * reembolsado, site desativado) em vez de esperar o webhook — evita duplo
 * reembolso. O webhook continua idempotente como redundância.
 */
export async function handleMpRefund(payment: MpPayment) {
  const admin = createAdminClient();
  const ref = payment.external_reference || "";
  const tenantId = tenantIdFromPayment(payment);
  if (!tenantId) return;

  const mpId = String(payment.id);
  const refundedAt = new Date().toISOString();
  const refundMeta = {
    refunded_at: refundedAt,
    refunded_amount_cents: Math.round((payment.transaction_amount || 0) * 100),
    mp_status: payment.status,
    ...(payment.status === "charged_back" ? { chargeback: true } : {}),
  };

  // Localiza a linha do pagamento original (qualquer status — inclui
  // `refund_pending` do pedido de garantia; a confirmação do MP promove para
  // `refunded` e desativa o site).
  const { data: original } = await admin
    .from("payments")
    .select("id, type, status, tenant_id, subscription_id, metadata")
    .eq("mercadopago_payment_id", mpId)
    .maybeSingle();
  const orig = original as {
    id: string;
    type: string;
    status: string;
    tenant_id: string;
    subscription_id: string | null;
    metadata: Record<string, unknown> | null;
  } | null;

  const payType: string = orig?.type || (ref.startsWith("mon_") || ref.startsWith("sub_") ? "subscription" : "activation");

  if (orig) {
    if (orig.status !== "refunded") {
      await admin
        .from("payments")
        .update({
          status: "refunded",
          metadata: { ...(orig.metadata || {}), ...refundMeta },
        })
        .eq("id", orig.id);
    }
  } else {
    // Reembolso de pagamento nunca registrado (ordem invertida): cria a
    // linha já como reembolsada para não perder o histórico.
    await admin.from("payments").insert({
      tenant_id: tenantId,
      mercadopago_payment_id: mpId,
      mercadopago_preference_id: payment.preference_id || null,
      type: payType,
      amount_cents: Math.round((payment.transaction_amount || 0) * 100),
      currency: (payment.currency_id || "brl").toLowerCase(),
      status: "refunded",
      metadata: { gateway: "mercadopago", external_reference: ref, ...refundMeta },
    });
  }

  // Linha de histórico da devolução (id próprio para não sobrescrever a
  // linha "Pago" original — histórico intacto). Promove eventual linha
  // "aguardando reembolso" para reembolsada.
  await admin.from("billing_history").upsert(
    {
      tenant_id: tenantId,
      mercadopago_payment_id: `${mpId}:refund`,
      type: payType,
      amount_cents: Math.round((payment.transaction_amount || 0) * 100),
      currency: "brl",
      status: "refunded",
    },
    { onConflict: "mercadopago_payment_id", ignoreDuplicates: true }
  );
  try {
    await admin
      .from("billing_history")
      .update({ status: "refunded" })
      .eq("tenant_id", tenantId)
      .eq("mercadopago_payment_id", `${mpId}:refund_pending`);
  } catch {}

  if (payType === "activation") {
    // Site desativado — usuário poderá pagar novamente e reativar (novo
    // pagamento aprovado gera novo registro; histórico anterior intacto).
    await deactivateTenant(tenantId, `reembolso do pagamento ${mpId}`);
    // Cancela assinaturas ativa/trialing vinculadas (sem elas o serviço não
    // continua válido; a reativação cria nova assinatura sem duplicar).
    const { data: actives } = await admin
      .from("subscriptions")
      .select("id, mercadopago_subscription_id")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trialing"]);
    for (const s of (actives as { id: string; mercadopago_subscription_id: string | null }[] | null) || []) {
      await admin.from("subscriptions").update({ status: "canceled" }).eq("id", s.id);
      if (s.mercadopago_subscription_id) {
        try {
          await cancelMpSubscription(s.mercadopago_subscription_id);
        } catch (e) {
          console.error("[mp] falha ao cancelar recorrência no MP após reembolso", e);
        }
      }
    }
    const { data: tOwner } = await admin.from("tenants").select("user_id").eq("id", tenantId).maybeSingle();
    if (tOwner?.user_id) {
      await auditPaymentEvent("user.site_suspended_refund", tOwner.user_id, tenantId, {
        gateway: "mercadopago",
        mp_payment_id: mpId,
      });
    }
  } else {
    // Mensalidade devolvida → inadimplência (fluxo "Pagar mensalidade" do painel).
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub) {
      await admin.from("subscriptions").update({ status: "past_due" }).eq("id", (sub as { id: string }).id);
    }
    const { data: tOwner } = await admin.from("tenants").select("user_id").eq("id", tenantId).maybeSingle();
    if (tOwner?.user_id) {
      await auditPaymentEvent("payment.refunded", tOwner.user_id, tenantId, {
        gateway: "mercadopago",
        mp_payment_id: mpId,
      });
    }
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

    const { status: rowStatus } = await reconcileSucceededPayment(admin, {
      tenantId,
      type: "subscription",
      subscriptionId: sub.id,
      payment,
      amountCents,
      paidAt: payment.date_approved ? new Date(payment.date_approved).toISOString() : new Date().toISOString(),
      metadata: { gateway: "mercadopago", external_reference: ref },
    });
    if (rowStatus === "refunded") return;

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
      await deactivateTenant(tenantId, `mensalidade ${payment.status}`);
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

export async function handleMpSubscriptionUpdate(subscriptionId: string) {
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
      await deactivateTenant(tenantId, `assinatura MP ${mpSub.status}`);
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
 * Cura de ativação: quando a ÚLTIMA atualização financeira é um pagamento
 * `succeeded` mas o site segue inativo (ex.: falha antiga na recorrência),
 * garante assinatura ativa/trialing (cria local a partir da oferta vigente
 * se não houver) e ativa o tenant. Idempotente — pode rodar sempre.
 * Usado pela página /painel/meu-site e pelo sync. Nunca toca afiliados.
 */
export async function ensureTenantActivated(tenantId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: active } = await admin
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle();
    if (!active) {
      const plan = await getActiveOffer();
      if (!plan) return false;
      const { data: lastPay } = await admin
        .from("payments")
        .select("metadata")
        .eq("tenant_id", tenantId)
        .eq("status", "succeeded")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const gateway =
        (lastPay as { metadata?: { gateway?: string } } | null)?.metadata?.gateway ||
        "mercadopago";
      const trialMonths = Math.max(1, plan.trial_months || 3);
      const trialEnd = new Date();
      trialEnd.setMonth(trialEnd.getMonth() + trialMonths);
      await admin.from("subscriptions").insert({
        tenant_id: tenantId,
        plan_id: plan.id,
        gateway,
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: trialEnd.toISOString(),
        next_billing_at: trialEnd.toISOString(),
        trial_end: trialEnd.toISOString(),
        activated_at: new Date().toISOString(),
        snapshot: {
          gateway,
          plan_id: plan.id,
          currency: "brl",
          activation_amount_cents: plan.activation_price_cents,
          monthly_amount_cents: plan.monthly_price_cents,
          trial_months: trialMonths,
          trial_period_days: trialMonths * 30,
          healed: true,
        },
      });
    }
    const { data: t } = await admin
      .from("tenants")
      .select("user_id")
      .eq("id", tenantId)
      .maybeSingle();
    await activateTenant(tenantId, (t as { user_id?: string } | null)?.user_id);
    return true;
  } catch (e) {
    console.error("[mp] falha na cura de ativação", e);
    return false;
  }
}

/**
 * Histórico de ativações/suspensões por pagamento (best-effort: nunca quebra
 * o processamento). actor = dono da conta; via identifica o gateway.
 */
export async function auditPaymentEvent(
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
