import { createAdminClient } from "@/lib/supabase/admin";
import { calcAffiliateCredit, type CreditBreakdown } from "@/lib/affiliate-credit-math";

export { calcAffiliateCredit, type CreditBreakdown };

/**
 * Crédito de afiliado no checkout.
 *
 * REGRAS DE SEGURANÇA:
 * - O frontend NUNCA define valores: ele só envia `useAffiliateCredit: true`.
 * - Saldo, cálculo, reserva e confirmação acontecem no backend (este módulo +
 *   RPCs da migration 0045), sempre a partir das tabelas (fonte de verdade).
 * - A reserva é atômica no Postgres (trava por usuário + validação de saldo
 *   dentro da transação) — impede gasto duplo em duplo clique/retentativas.
 * - A confirmação (applied) acontece SOMENTE no webhook, após pagamento
 *   aprovado. Falha/expiração libera (released) e o saldo volta.
 */

export type ChargeKind = "activation" | "subscription";

export interface ReservedCredit extends CreditBreakdown {
  /** Id da reserva em affiliate_credit_usages (null quando infra ausente). */
  usageId: string | null;
}

/** Erros que indicam infra de crédito ausente (migration 0045 não aplicada). */
function isMissingInfraError(e: unknown): boolean {
  const msg = String((e as { message?: unknown })?.message || e || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("undefined_function") ||
    msg.includes("undefined_table") ||
    msg.includes("42p01") ||
    msg.includes("42883") ||
    msg.includes("could not find the function") ||
    msg.includes("could not find the table")
  );
}

/**
 * Saldo de crédito disponível do usuário em centavos, somando:
 *   - o saldo de comissões do afiliado (`get_affiliate_balance`), e
 *   - o "Saldo em Conta" (crédito manual do admin, `get_account_credit_available`).
 *
 * Quando `kind` é informado, o Saldo em Conta considera apenas as concessões
 * compatíveis com o tipo da compra (incluindo as marcadas como "both").
 *
 * Retorna `enabled: false` quando a infra (migration 0045) ainda não existe —
 * nesse caso o checkout segue normalmente SEM crédito (fail closed).
 */
export async function getAffiliateCreditBalance(
  userId: string,
  kind?: ChargeKind
): Promise<{ cents: number; enabled: boolean }> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("get_affiliate_balance", { p_user_id: userId });
    if (error) {
      if (isMissingInfraError(error)) return { cents: 0, enabled: false };
      throw error;
    }
    // RPC retorna reais (numeric). Converte para centavos (piso — nunca a maior).
    const affiliateCents = Math.max(0, Math.floor(Number(data || 0) * 100));

    // Saldo em Conta (migration 0059). Ausente → conta como zero, sem quebrar.
    let accountCents = 0;
    try {
      const { data: acct, error: acctError } = await admin.rpc(
        "get_account_credit_available",
        { p_user_id: userId, p_kind: kind || null }
      );
      if (acctError) {
        if (!isMissingInfraError(acctError)) throw acctError;
      } else {
        accountCents = Math.max(0, Math.floor(Number(acct || 0) * 100));
      }
    } catch (e) {
      if (!isMissingInfraError(e)) throw e;
    }

    return { cents: affiliateCents + accountCents, enabled: true };
  } catch (e) {
    if (isMissingInfraError(e)) return { cents: 0, enabled: false };
    throw e;
  }
}

export interface AccountCreditBreakdown {
  /** Disponível para ativação (inclui as concessões 'both'). */
  activationCents: number;
  /** Disponível para mensalidade (inclui as concessões 'both'). */
  subscriptionCents: number;
  /** Total disponível (concessões ativas − já consumido). */
  totalCents: number;
}

export interface AccountCreditSummary extends AccountCreditBreakdown {
  /** Total efetivamente concedido pelo superadmin (concessões ativas). */
  grantedCents: number;
  /** Já utilizado (concedido − disponível). Nunca negativo. */
  usedCents: number;
}

/**
 * Visão completa do "Saldo em Conta" (crédito manual do admin) para exibição
 * no painel: disponível (por tipo + total), total concedido e já utilizado.
 * Nunca lança — devolve zeros quando a infra (migration 0059) não existe.
 */
export async function getAccountCreditSummary(
  userId: string
): Promise<AccountCreditSummary> {
  const zero: AccountCreditSummary = {
    grantedCents: 0,
    usedCents: 0,
    activationCents: 0,
    subscriptionCents: 0,
    totalCents: 0,
  };
  try {
    const admin = createAdminClient();
    const breakdown = await getAccountCreditBreakdown(userId);
    const { data: grants, error } = await admin
      .from("account_credit_grants")
      .select("amount, status")
      .eq("user_id", userId)
      .eq("status", "active");
    if (error) {
      if (isMissingInfraError(error)) return { ...zero, ...breakdown };
      throw error;
    }
    const grantedCents = ((grants || []) as { amount: number | string }[]).reduce(
      (sum, g) => sum + Math.round(Number(g.amount) * 100),
      0
    );
    return {
      ...breakdown,
      grantedCents,
      usedCents: Math.max(0, grantedCents - breakdown.totalCents),
    };
  } catch (e) {
    if (isMissingInfraError(e)) return zero;
    return zero;
  }
}

/**
 * Detalhamento do "Saldo em Conta" (crédito manual do admin) em centavos.
 * Usado no painel para o usuário ver o que pode usar na ativação/mensalidade.
 * Retorna zeros quando a infra (migration 0059) ainda não existe.
 */
export async function getAccountCreditBreakdown(
  userId: string
): Promise<AccountCreditBreakdown> {
  const zero: AccountCreditBreakdown = {
    activationCents: 0,
    subscriptionCents: 0,
    totalCents: 0,
  };
  try {
    const admin = createAdminClient();
    const toCents = (v: unknown) => Math.max(0, Math.floor(Number(v || 0) * 100));
    const [act, sub, all] = await Promise.all([
      admin.rpc("get_account_credit_available", { p_user_id: userId, p_kind: "activation" }),
      admin.rpc("get_account_credit_available", { p_user_id: userId, p_kind: "subscription" }),
      admin.rpc("get_account_credit_available", { p_user_id: userId, p_kind: null }),
    ]);
    for (const r of [act, sub, all]) {
      if (r.error) {
        if (isMissingInfraError(r.error)) return zero;
        throw r.error;
      }
    }
    return {
      activationCents: toCents(act.data),
      subscriptionCents: toCents(sub.data),
      totalCents: toCents(all.data),
    };
  } catch (e) {
    if (isMissingInfraError(e)) return zero;
    throw e;
  }
}

/**
 * Reserva o crédito para uma tentativa de pagamento.
 * Retorna null quando a infra está ausente (chamador segue sem crédito).
 * Nunca propaga erro de infra — pagamento nunca é bloqueado por isso.
 */
export async function reserveAffiliateCredit(input: {
  userId: string;
  amountCents: number;
  tenantId: string;
  kind: ChargeKind;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const amountReais = Math.floor(Number(input.amountCents) || 0) / 100;
  if (amountReais <= 0) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("reserve_affiliate_credit", {
      p_user_id: input.userId,
      p_amount: amountReais,
      p_tenant_id: input.tenantId,
      p_kind: input.kind,
      p_metadata: input.metadata || {},
    });
    if (error) {
      // Saldo insuficiente ou infra ausente: sem crédito, sem bloqueio.
      console.warn("[affiliate-credit] reserva indisponível:", error.message);
      return null;
    }
    return (data as string) || null;
  } catch (e) {
    console.warn(
      "[affiliate-credit] reserva indisponível:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/** Confirma a utilização (chamado pelo webhook após pagamento aprovado). */
export async function applyAffiliateCredit(
  usageId: string | null | undefined,
  paymentId?: string | null
): Promise<boolean> {
  if (!usageId) return false;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("apply_affiliate_credit", {
      p_usage_id: usageId,
      p_payment_id: paymentId || null,
    });
    if (error) {
      console.error("[affiliate-credit] falha ao confirmar uso:", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error(
      "[affiliate-credit] falha ao confirmar uso:",
      e instanceof Error ? e.message : e
    );
    return false;
  }
}

/** Libera a reserva (pagamento recusado/expirado/abandonado). Best-effort. */
export async function releaseAffiliateCredit(
  usageId: string | null | undefined
): Promise<boolean> {
  if (!usageId) return false;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("release_affiliate_credit", {
      p_usage_id: usageId,
    });
    if (error) {
      console.warn("[affiliate-credit] falha ao liberar reserva:", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.warn(
      "[affiliate-credit] falha ao liberar reserva:",
      e instanceof Error ? e.message : e
    );
    return false;
  }
}
