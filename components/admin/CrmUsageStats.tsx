"use client";

import { useEffect, useState } from "react";

type CrmAdminStats = {
  tenantsUsingCrm: number;
  totalTenants: number;
  clients: number;
  sales: number;
  financialEntries: number;
  charges: number;
  tasks: number;
  whatsappEnabled: number;
  loyaltyEnabled: number;
  modules: Record<string, number>;
};

export function CrmUsageStats() {
  const [stats, setStats] = useState<CrmAdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/crm/stats")
      .then((r) => r.json())
      .then((json) => setStats(json.stats))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400">Carregando estatísticas do CRM...</p>;
  if (!stats) return null;

  const moduleLabels: Record<string, string> = {
    fidelidade: "Fidelidade",
    financeiro: "Financeiro",
    cobrancas: "Cobranças",
    whatsapp: "WhatsApp",
    automacoes: "Automações",
    relatorios: "Relatórios",
  };

  return (
    <div className="card">
      <h2 className="card-title mb-3">Uso global do CRM</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-5">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Consultores com CRM</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{stats.tenantsUsingCrm} <span className="text-sm text-gray-400">/ {stats.totalTenants}</span></p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Clientes</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{stats.clients}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Vendas</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{stats.sales}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Movimentações</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{stats.financialEntries}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Cobranças</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{stats.charges}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Tarefas</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{stats.tasks}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">WhatsApp ativo</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{stats.whatsappEnabled}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Fidelidade ativa</p>
          <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{stats.loyaltyEnabled}</p>
        </div>
      </div>

      <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Módulos ativos (consultores)</p>
      <div className="space-y-1">
        {Object.entries(stats.modules || {}).map(([key, count]) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{moduleLabels[key] || key}</span>
            <span className="text-gray-400">{count} consultores</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-4">
        Apenas métricas agregadas — os dados individuais de cada consultor nunca são exibidos aqui.
      </p>
    </div>
  );
}