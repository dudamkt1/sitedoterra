"use client";

import { useEffect, type ReactNode } from "react";

type CrmModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Define a largura máxima do modal. Default `max-w-lg`. */
  wide?: boolean;
  /** Ações fixas no rodapé (recomendado para Salvar/Cancelar em modais longos). */
  footer?: ReactNode;
  /** Fecha ao pressionar ESC. Default `true`. */
  closeOnEsc?: boolean;
};

/**
 * Modal padrão do CRM.
 *
 * Estrutura:
 *   <overlay fixed full-screen + scroll de fallback>
 *     <modal card>
 *       <header fixo>          ← título + botão fechar SEMPRE acessíveis
 *       <body com scroll>      ← `children` (conteúdo rola aqui dentro)
 *       <footer fixo opcional> ← ações (Salvar/Cancelar) sempre visíveis
 *     </modal>
 *   </overlay>
 *
 * - Respeita `100dvh` (viewport dinâmica em mobile, ignora barra de URL).
 * - Margens mínimas (16px) em qualquer viewport.
 * - Centraliza horizontal e verticalmente; em telas muito baixas,
 *   o `body` rola internamente — a página nunca rola.
 * - Bloqueia o scroll do `<body>` enquanto o modal está aberto.
 */
export function CrmModal({ title, onClose, children, wide, footer, closeOnEsc = true }: CrmModalProps) {
  useEffect(() => {
    if (!closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeOnEsc, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
      onClick={(e) => {
        // fecha ao clicar no backdrop, mas não quando o clique é dentro do modal
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)] flex flex-col w-full ${
          wide ? "sm:max-w-4xl" : "sm:max-w-lg"
        } max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl overflow-hidden`}
      >
        {/* Header fixo */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-white">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition text-base"
          >
            ✕
          </button>
        </div>

        {/* Body com scroll interno */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5">
          {children}
        </div>

        {/* Footer fixo (opcional) */}
        {footer && (
          <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, sub, action }: { icon: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-semibold text-gray-700">{title}</p>
      {sub && <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="py-16 text-center text-gray-400 text-sm">
      <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-[#1d5c3a] rounded-full animate-spin mb-3" />
      {label || "Carregando..."}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-12 text-center">
      <p className="text-red-600 text-sm">⚠️ {message}</p>
      {onRetry && (
        <button className="btn btn-outline mt-4 text-xs" onClick={onRetry}>Tentar novamente</button>
      )}
    </div>
  );
}

export function CrmStatusBadge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const cls = colorMap[value] || "badge-gray";
  return <span className={`badge ${cls}`}>{value}</span>;
}

export function Money({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={className}>
      {(cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
    </span>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function confirmDialog(message: string): boolean {
  return typeof window !== "undefined" && window.confirm(message);
}

export async function apiPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Erro ao salvar.");
  return json;
}

export async function apiPut(path: string, body: Record<string, unknown>) {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Erro ao atualizar.");
  return json;
}

export async function apiDelete(path: string) {
  const res = await fetch(path, { method: "DELETE" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Erro ao excluir.");
  return json;
}

export function Toast({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className={`mb-3 rounded-lg px-4 py-2.5 text-sm ${msg.ok ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
      {msg.text}
    </p>
  );
}