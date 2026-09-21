// Helpers PUROS do programa de fidelidade (sem banco, sem React).
// Usados pela tela /painel/crm/fidelidade, pela ficha do cliente e por testes.
// Compatível com níveis legados ({ name, min_points }) — campos novos são opcionais.
import type { CrmLoyaltyLevel } from "@/types";

export function sortedLevels(levels: CrmLoyaltyLevel[] | null | undefined): CrmLoyaltyLevel[] {
  return [...(levels || [])].sort((a, b) => (a.min_points || 0) - (b.min_points || 0));
}

export interface LevelPosition {
  /** Nível atual (null quando não há níveis configurados). */
  level: CrmLoyaltyLevel | null;
  /** Índice do nível atual na lista ordenada (-1 sem níveis). */
  index: number;
  /** Próximo nível (null quando já está no máximo ou sem níveis). */
  next: CrmLoyaltyLevel | null;
  /** Pontos que faltam para o próximo nível (0 quando no máximo). */
  missing: number;
  /** Progresso 0-100 até o próximo nível (100 quando no máximo). */
  progress: number;
}

/** Posição de um saldo de pontos na régua de níveis. */
export function levelPosition(levels: CrmLoyaltyLevel[] | null | undefined, points: number): LevelPosition {
  const sorted = sortedLevels(levels);
  if (sorted.length === 0) return { level: null, index: -1, next: null, missing: 0, progress: 100 };
  const pts = Math.max(0, Math.floor(Number(points) || 0));
  let index = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (pts >= (sorted[i].min_points || 0)) index = i;
  }
  const level = sorted[index];
  const next = index + 1 < sorted.length ? sorted[index + 1] : null;
  if (!next) return { level, index, next: null, missing: 0, progress: 100 };
  const base = level.min_points || 0;
  const span = Math.max(1, (next.min_points || 0) - base);
  const missing = Math.max(0, (next.min_points || 0) - pts);
  const progress = Math.min(100, Math.max(0, Math.round(((pts - base) / span) * 100)));
  return { level, index, next, missing, progress };
}

/** Nome do nível para um saldo (mesma regra histórica da API). */
export function levelNameForPoints(levels: CrmLoyaltyLevel[] | null | undefined, points: number, fallback = "Bronze"): string {
  const pos = levelPosition(levels, points);
  return pos.level?.name || fallback;
}

/**
 * Cliente "perto de subir de nível": faltam poucos pontos em absoluto
 * (<= 50) ou o progresso já passou de 80% da faixa atual.
 */
export function isCloseToNextLevel(missing: number, progress: number): boolean {
  if (missing <= 0) return false;
  return missing <= 50 || progress >= 80;
}

/** Benefícios efetivos de um nível (próprios; globais somados na UI). */
export function levelBenefits(level: CrmLoyaltyLevel | null | undefined): string[] {
  if (!level) return [];
  return Array.isArray(level.benefits) ? level.benefits.filter(Boolean) : [];
}

/** Linha-resumo de desconto de um nível ("10% de desconto" ou null). */
export function levelDiscountLabel(level: CrmLoyaltyLevel | null | undefined): string | null {
  const d = Number(level?.discount_percent);
  if (!level || Number.isNaN(d) || d <= 0) return null;
  return `${Math.min(100, d)}% de desconto`;
}
