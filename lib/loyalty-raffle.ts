// Helpers PUROS do Sorteio por Fidelidade (sem banco, sem React).
// Usados pelas APIs do painel, pela página pública e pelo modo demonstração.
// Espelha o padrão de lib/crm-loyalty.ts.

import type { LoyaltyRafflePrizeType } from "@/types";

/** Descrição do algoritmo verificável, gravada em cada rodada sorteada. */
export const RAFFLE_ALGORITHM =
  "Sorteio verificável v1: sorteada semente aleatória de 128 bits (32 hex). " +
  "Os números preenchidos são ordenados de forma crescente; o vencedor é o " +
  "de índice (primeiros 8 hex da semente como uint32) módulo (quantidade de " +
  "números preenchidos). Semente + timestamp + lista de participantes ficam " +
  "registrados para auditoria.";

export const RAFFLE_PRIZE_LABELS: Record<LoyaltyRafflePrizeType, string> = {
  brinde: "Brinde",
  dinheiro: "Dinheiro",
  credito_loja: "Crédito na loja",
};

export const RAFFLE_MIN_NUMBERS = 2;
export const RAFFLE_MAX_NUMBERS = 1000;

/**
 * Quantos números da sorte uma compra gera.
 * Mesmo padrão de `crm_loyalty` (floor sobre o valor, nunca negativo).
 */
export function numbersForPurchase(totalCents: number, amountPerNumberCents: number): number {
  const total = Math.floor(Number(totalCents) || 0);
  const per = Math.floor(Number(amountPerNumberCents) || 0);
  if (total <= 0 || per <= 0) return 0;
  return Math.floor(total / per);
}

/** Normaliza total_numbers para o intervalo permitido (2-1000). */
export function clampTotalNumbers(v: unknown): number {
  const n = Math.floor(Number(v) || 0);
  if (!Number.isFinite(n)) return 30;
  return Math.min(RAFFLE_MAX_NUMBERS, Math.max(RAFFLE_MIN_NUMBERS, n));
}

/** Normaliza amount_per_number_cents (mínimo 1 centavo). */
export function clampAmountCents(v: unknown, fallback = 5000): number {
  const n = Math.round(Number(v) || 0);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(100_000_000, n);
}

/** Semente aleatória de 128 bits em hex (isomórfica: browser + node). */
export function generateSeed(): string {
  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.getRandomValues === "function") {
      const b = new Uint8Array(16);
      c.getRandomValues(b);
      return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // cai para o fallback abaixo
  }
  let s = "";
  for (let i = 0; i < 32; i++) s += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  return s;
}

/**
 * Índice (0-based) do vencedor entre os números preenchidos ordenados.
 * Verificável com qualquer calculadora: parseInt(seed[0:8], 16) % N.
 */
export function drawWinnerIndex(seed: string, filledCount: number): number {
  if (!Number.isInteger(filledCount) || filledCount <= 0) {
    throw new Error("Rodada sem números preenchidos.");
  }
  const head = parseInt(String(seed).slice(0, 8), 16);
  if (!Number.isFinite(head)) throw new Error("Semente inválida.");
  return head % filledCount;
}

/** Primeiro nome (exibição pública sem expor dados completos). */
export function firstNameOf(fullName: string): string {
  const first = String(fullName || "").trim().split(/\s+/)[0] || "";
  return first.slice(0, 24);
}

/** Iniciais (fallback de exibição pública). */
export function initialsOf(fullName: string): string {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Formata centavos em BRL (ex.: 5000 -> "R$ 50,00"). */
export function formatBRL(cents: number): string {
  return (Math.round(Number(cents) || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
