/**
 * Forma de pagamento de um lançamento financeiro.
 *
 * Módulo PURO (sem imports de servidor) — pode ser usado tanto no backend
 * (checkout, webhooks) quanto em componentes de UI.
 *
 * Valores persistidos em `payments.payment_method` / `billing_history.payment_method`:
 *   - "pix"    → PIX (Mercado Pago)
 *   - "card"   → cartão de crédito (Stripe ou Mercado Pago)
 *   - "credit" → quitado 100% por saldo/crédito (Saldo em Conta e/ou afiliados)
 *   - "mixed"  → parte por saldo/crédito + parte no gateway
 *   - "manual" → lançamento manual (admin)
 *   - "other"  → não identificado
 */
export type PaymentMethod = "pix" | "card" | "credit" | "mixed" | "manual" | "other";

export const PAYMENT_METHOD_VALUES: readonly PaymentMethod[] = [
  "pix",
  "card",
  "credit",
  "mixed",
  "manual",
  "other",
] as const;

/**
 * Deriva a forma de pagamento a partir do que foi calculado no checkout.
 *
 * @param payMethod          "pix" | "card" | null (método no gateway)
 * @param creditAppliedCents valor abatido por saldo/crédito (centavos)
 * @param amountCents        valor efetivamente cobrado no gateway (centavos)
 */
export function resolvePaymentMethod(input: {
  payMethod?: string | null;
  creditAppliedCents?: number | null;
  amountCents?: number | null;
}): PaymentMethod {
  const credit = Math.max(0, Math.floor(Number(input.creditAppliedCents) || 0));
  const amount = Math.max(0, Math.floor(Number(input.amountCents) || 0));
  if (credit > 0) return amount > 0 ? "mixed" : "credit";
  if (input.payMethod === "pix") return "pix";
  if (input.payMethod === "card") return "card";
  return "other";
}

/** Normaliza um valor vindo do banco para um PaymentMethod válido (ou null). */
export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (PAYMENT_METHOD_VALUES as readonly string[]).includes(v) ? (v as PaymentMethod) : null;
}

const LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  card: "Cartão",
  credit: "Saldo/Crédito",
  mixed: "Saldo + pagamento",
  manual: "Manual",
  other: "Não informado",
};

const DESCRIPTIONS: Record<PaymentMethod, string> = {
  pix: "Pago via PIX (Mercado Pago).",
  card: "Pago com cartão de crédito.",
  credit: "Quitado com Saldo em Conta e/ou saldo de afiliados.",
  mixed: "Parte paga com saldo/crédito e o restante no gateway.",
  manual: "Lançamento manual feito pela equipe.",
  other: "Forma de pagamento não identificada.",
};

export function paymentMethodLabel(method: string | null | undefined): string {
  const m = normalizePaymentMethod(method);
  return m ? LABELS[m] : LABELS.other;
}

export function paymentMethodDescription(method: string | null | undefined): string {
  const m = normalizePaymentMethod(method);
  return m ? DESCRIPTIONS[m] : DESCRIPTIONS.other;
}

/** Linha de histórico (payments/billing_history) — formato mínimo aceito. */
export interface PaymentRowLike {
  payment_method?: string | null;
  credit_applied_cents?: number | null;
  amount_cents?: number | null;
  gateway?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Forma de pagamento de uma linha de histórico. Usa a coluna `payment_method`
 * quando presente; caso contrário, deriva dos dados legados (metadata/gateway)
 * para que registros antigos também exibam corretamente.
 */
export function paymentMethodFromRow(row: PaymentRowLike): PaymentMethod {
  const direct = normalizePaymentMethod(row.payment_method);
  if (direct) return direct;

  const md = (row.metadata as Record<string, unknown> | null) || null;
  const credit = Math.max(
    0,
    Math.floor(
      Number(row.credit_applied_cents ?? (md?.credit_applied_cents as number | undefined) ?? 0) || 0
    )
  );
  const amount = Math.max(0, Math.floor(Number(row.amount_cents) || 0));
  const gateway = String(row.gateway || md?.gateway || "").toLowerCase();
  const payMethod = (md?.pay_method as string | undefined) || null;

  if (gateway === "affiliate_credit") return "credit";
  if (credit > 0) return amount > 0 ? "mixed" : "credit";
  if (payMethod === "pix") return "pix";
  if (payMethod === "card") return "card";
  if (gateway === "stripe") return "card";
  return "other";
}
