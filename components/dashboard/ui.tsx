"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  type = "button",
  ...props
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "destructive" | "green";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  [key: string]: unknown;
}) {
  const base = "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[#1d5c3a] text-white hover:bg-[#165030] focus:ring-[#1d5c3a]",
    outline: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300",
    destructive: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    green: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="w-full">
      {props.label && <label className="label">{props.label}</label>}
      <input
        className={`input ${className}`}
        {...props}
      />
      {props.error && <p className="text-xs text-red-600 mt-1">{props.error}</p>}
    </div>
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="w-full">
      {props.label && <label className="label">{props.label}</label>}
      <select className={`input ${className}`} {...props}>
        {children}
      </select>
    </div>
  );
}

export function Checkbox({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer ${className}`}>
      <input type="checkbox" className="checkbox" {...props} />
      {props.label && <span className="text-sm text-gray-700">{props.label}</span>}
    </label>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Ativo", cls: "badge-green" },
    succeeded: { label: "Pago", cls: "badge-green" },
    ssl_pending: { label: "SSL pendente", cls: "badge-blue" },
    verified: { label: "Verificado", cls: "badge-green" },
    verifying: { label: "Verificando", cls: "badge-blue" },
    pending: { label: "Pendente", cls: "badge-yellow" },
    awaiting_activation: { label: "Aguardando ativação", cls: "badge-yellow" },
    past_due: { label: "Pagamento pendente", cls: "badge-red" },
    unpaid: { label: "Inadimplente", cls: "badge-red" },
    canceled: { label: "Cancelada", cls: "badge-gray" },
    cancelled: { label: "Cancelado", cls: "badge-gray" },
    suspended: { label: "Suspenso", cls: "badge-red" },
    blocked: { label: "Bloqueado", cls: "badge-red" },
    incomplete: { label: "Em processamento", cls: "badge-yellow" },
    trialing: { label: "Teste", cls: "badge-blue" },
    error: { label: "Erro", cls: "badge-red" },
    removed: { label: "Removido", cls: "badge-gray" },
    failed: { label: "Falhou", cls: "badge-red" },
    refunded: { label: "Reembolsado", cls: "badge-gray" },
    pending_activation: { label: "Aguardando ativação", cls: "badge-yellow" },
    paused: { label: "Pausada", cls: "badge-gray" },
  };
  const s = map[status] || { label: status, cls: "badge-gray" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: string | ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
          <p className="mt-2 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        {children}
      </h1>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
