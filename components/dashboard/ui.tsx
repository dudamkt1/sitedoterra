"use client";

import type { ReactNode } from "react";

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
