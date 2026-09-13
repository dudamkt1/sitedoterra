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
 * Saldo de crédito disponível do usuário em centavos.
 * Retorna `enabled: false` quando a infra (migration 0045) ainda não existe —
 * nesse caso o checkout segue normalmente SEM crédito (fail closed).
 */
export async function getAffiliateCreditBalance(
  userId: string
): Promise<{ cents: number; enabled: boolean }> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("get_affiliate_balance", { p_user_id: userId });
    if (error) {
      if (isMissingInfraError(error)) return { cents: 0, enabled: false };
      throw error;
    }
    // RPC retorna reais (numeric). Converte para centavos (piso — nunca a maior).
    const cents = Math.max(0, Math.floor(Number(data || 0) * 100));
    return { cents, enabled: true };
  } catch (e) {
    if (isMissingInfraError(e)) return { cents: 0, enabled: false };
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
