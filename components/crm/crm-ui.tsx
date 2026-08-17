"use client";

import type { ReactNode } from "react";

export function CrmModal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className={`card w-full ${wide ? "max-w-4xl" : "max-w-lg"} my-8`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-title">{title}</h3>
          <button className="text-gray-400 text-xl hover:text-gray-600" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        {children}
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