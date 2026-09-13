/**
 * Matemática PURA do crédito de afiliado (zero imports — unit-testável).
 * Espelha 1:1 a regra aplicada no backend (buildCheckoutQuote).
 */

export interface CreditBreakdown {
  /** Valor original da compra em centavos (já com desconto de PIX, se houver). */
  originalCents: number;
  /** Crédito de afiliado utilizado em centavos (nunca acima do original). */
  creditCents: number;
  /** Valor restante a pagar no gateway em centavos (fixo até a conclusão). */
  totalCents: number;
}

/**
 * Usa no máximo o saldo disponível e nunca ultrapassa o valor da compra.
 * Se o crédito cobrir tudo, o total é R$ 0,00 e a sobra segue disponível.
 */
export function calcAffiliateCredit(baseCents: number, balanceCents: number): CreditBreakdown {
  const base = Math.max(0, Math.floor(Number(baseCents) || 0));
  const balance = Math.max(0, Math.floor(Number(balanceCents) || 0));
  const creditCents = Math.min(base, balance);
  return { originalCents: base, creditCents, totalCents: base - creditCents };
}
