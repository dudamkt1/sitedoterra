"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Input monetário com máscara brasileira (R$ 0.000,00).
 *
 * - Trabalha com **centavos** internamente (`value` em cents) — sem ponto flutuante.
 * - Aceita digitação livre: o usuário digita números/`,`/`.` e o componente
 *   formata visualmente em R$ 0.000,00 sem bloquear a edição.
 * - Substitui `<input type="number">` removendo as setas nativas de stepper.
 * - Em mobile, ativa teclado numérico (`inputMode="numeric"`).
 * - Cola valores em vários formatos: "1.234,56" / "1234.56" / "1234" / "R$ 1.500,00".
 *
 * IMPORTANTE: usa **string local** sincronizada com o `value` em cents.
 * O input é controlado pela string local (não pelo `value` em cents) para
 * que cada keystroke atualize a máscara sem reescrever o input do zero a
 * cada render — isso evita perda de cursor, regressão de caracteres e
 * a sensação de "o campo não aceita digitação".
 */
type Props = {
  /** Valor em centavos (inteiro). */
  value: number;
  /** Recebe sempre o valor em centavos. */
  onChange: (cents: number) => void;
  placeholder?: string;
  className?: string;
  /** Texto do prefixo (default: "R$"). */
  prefix?: string;
  /** Se true, aceita valores negativos. */
  allowNegative?: boolean;
  /** Desabilita o input. */
  disabled?: boolean;
  /** id do input (acessibilidade). */
  id?: string;
  /** name do input (formulários). */
  name?: string;
  /** Limite máximo em centavos. Default: sem limite. */
  maxCents?: number;
  /** aria-label quando não há label visível. */
  "aria-label"?: string;
};

/** Converte string digitada em centavos (inteiro). */
export function parseBRLToCents(raw: string, allowNegative = false): number {
  if (!raw) return 0;
  let s = raw.trim();
  if (allowNegative && s.startsWith("-")) s = s.slice(1);
  // Remove tudo que não é dígito, vírgula, ponto ou sinal.
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return 0;

  // Detecta separador decimal: o último "." ou "," é o decimal.
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let intPart: string;
  let decPart: string | null = null;
  if (lastDot === -1 && lastComma === -1) {
    intPart = s;
  } else if (lastDot > lastComma) {
    intPart = s.slice(0, lastDot).replace(/[.,]/g, "");
    decPart = s.slice(lastDot + 1).replace(/[.,]/g, "").slice(0, 2);
  } else {
    intPart = s.slice(0, lastComma).replace(/[.,]/g, "");
    decPart = s.slice(lastComma + 1).replace(/[.,]/g, "").slice(0, 2);
  }
  intPart = intPart.replace(/^0+(\d)/, "$1"); // remove zeros à esquerda mantendo o último
  const intNum = intPart ? parseInt(intPart, 10) : 0;
  const decNum = decPart ? parseInt(decPart.padEnd(2, "0").slice(0, 2), 10) : 0;
  if (Number.isNaN(intNum) || Number.isNaN(decNum)) return 0;
  const cents = intNum * 100 + decNum;
  return allowNegative && raw.trim().startsWith("-") ? -cents : cents;
}

/** Formata centavos como "R$ 0.000,00" (com prefixo e separadores brasileiros). */
export function formatCentsToBRL(cents: number, prefix = "R$"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const intPart = Math.floor(abs / 100).toString();
  const decPart = (abs % 100).toString().padStart(2, "0");
  const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${prefix} ${intWithSep},${decPart}`;
}

export function MoneyInput({
  value,
  onChange,
  placeholder = "R$ 0,00",
  className = "input",
  prefix = "R$",
  allowNegative = false,
  disabled,
  id,
  name,
  maxCents,
  "aria-label": ariaLabel,
}: Props) {
  // String controlada localmente — refletida 1:1 no <input value={...} />.
  // Isso é o que permite digitação livre, cursor estável e reatividade sem
  // reescrever o DOM a cada keystroke.
  const [text, setText] = useState(() => formatCentsToBRL(value, prefix));
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Guarda o último cents emitido por este input, para distinguir mudanças
  // externas (ex.: seleção de produto) de mudanças causadas pelo próprio usuário.
  const lastEmittedCents = useRef<number>(value);

  // Sincroniza SOMENTE quando o `value` externo muda por uma fonte diferente
  // do próprio input (ex.: pickProduct() no pai). Não dispara em updates
  // originados pelo onChange deste componente.
  useEffect(() => {
    if (value === lastEmittedCents.current) return;
    const formatted = formatCentsToBRL(value, prefix);
    setText(formatted);
    lastEmittedCents.current = value;
  }, [value, prefix]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setText(next);
    const cents = parseBRLToCents(next, allowNegative);
    const capped = typeof maxCents === "number" ? Math.min(cents, maxCents) : cents;
    lastEmittedCents.current = capped;
    onChange(capped);
  }

  function handleBlur() {
    // Ao sair do campo, normaliza para a forma canônica "R$ 0.000,00".
    const cents = parseBRLToCents(text, allowNegative);
    const capped = typeof maxCents === "number" ? Math.min(cents, maxCents) : cents;
    const formatted = formatCentsToBRL(capped, prefix);
    setText(formatted);
    if (capped !== lastEmittedCents.current) {
      lastEmittedCents.current = capped;
      onChange(capped);
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    // Seleciona tudo para edição rápida (UX comum em campos monetários).
    requestAnimationFrame(() => {
      try { e.target.select(); } catch { /* noop */ }
    });
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      id={id}
      name={name}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      // Esconde setas de number em todos os browsers (defesa em profundidade)
      className={`${className} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]`}
    />
  );
}
