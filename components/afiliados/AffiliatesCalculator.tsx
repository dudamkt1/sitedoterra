"use client";

import { useState } from "react";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface AffiliatesCalculatorProps {
  commissionPercent: number;
  activationPriceCents: number;
}

/**
 * Calculadora de ganhos — slider 1–20 indicações/mês.
 * Comissão só sobre a ATIVAÇÃO: indicações × % × valor de ativação.
 */
export function AffiliatesCalculator({ commissionPercent, activationPriceCents }: AffiliatesCalculatorProps) {
  const [count, setCount] = useState(5);
  const perSale = Math.round((activationPriceCents * commissionPercent) / 100);
  const monthly = perSale * count;

  return (
    <div className="rounded-[24px] bg-white border border-[#e7ece8] shadow-[0_16px_48px_rgba(16,61,45,0.08)] p-6 sm:p-10">
      <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#1d5c3a]">
        Calculadora de ganhos
      </p>
      <label htmlFor="aff-indicacoes" className="mt-4 flex items-center justify-between gap-4 text-[14px] sm:text-[15px] font-semibold text-[#0f1a2a] leading-relaxed">
        <span>Quantas consultoras você indica por mês?</span>
        <span className="shrink-0 inline-flex items-center justify-center min-w-[52px] h-[38px] px-3 rounded-xl bg-[#eef6ee] border border-[#cfe6d4] text-[16px] font-extrabold text-[#1d5c3a]">
          {count}
        </span>
      </label>
      <input
        id="aff-indicacoes"
        type="range"
        min={1}
        max={20}
        step={1}
        value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        className="mt-4 w-full h-2 rounded-full bg-[#e5efe6] accent-[#1d5c3a] cursor-pointer"
        aria-describedby="aff-resultado"
      />
      <div className="mt-2 flex justify-between text-[11.5px] font-semibold text-[#8a9aa8]">
        <span>1</span>
        <span>20</span>
      </div>

      <div id="aff-resultado" aria-live="polite" className="mt-6 rounded-[16px] bg-gradient-to-br from-[#1d5c3a] to-[#0d3320] px-6 py-6 sm:py-7 text-center">
        <p className="text-[13px] font-medium text-white/75 leading-relaxed">
          Com {count} {count === 1 ? "indicação" : "indicações"}/mês, você pode ganhar aproximadamente
        </p>
        <p className="mt-1.5 text-[32px] sm:text-[40px] font-extrabold text-white tracking-tight leading-none">
          {brl(monthly)}
          <span className="text-[15px] font-semibold text-white/70">/mês</span>
        </p>
        <p className="mt-2 text-[12.5px] text-white/65 leading-relaxed">
          {commissionPercent}% sobre a ativação ({brl(activationPriceCents)}) por indicação · {brl(perSale)} cada
        </p>
      </div>
      <p className="mt-4 text-center text-[11.5px] sm:text-[12px] leading-relaxed text-[#8a9aa8]">
        *Estimativa com base no percentual vigente. Valores reais dependem das ativações confirmadas no mês.
      </p>
    </div>
  );
}
