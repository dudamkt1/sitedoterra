"use client";

import { useDemoStore } from "@/lib/demo/store";
import { formatBRL } from "@/lib/utils";

export function PainelDemoRelatorios() {
  const { ready, data } = useDemoStore();
  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  const totalClientes = data.clients.length;
  const totalVendas = data.sales.length;
  const totalReceita = data.sales.filter((s) => s.status === "pago").reduce((a, s) => a + s.total, 0);
  const totalPendente = data.sales.filter((s) => s.status === "pendente").reduce((a, s) => a + s.total, 0);
  const vips = data.clients.filter((c) => c.vip).length;
  const ticketMedio = totalVendas > 0 ? (data.sales.reduce((a, s) => a + s.total, 0) / totalVendas) : 0;

  // Vendas por mês (últimos 6 meses)
  const now = new Date();
  const months: { label: string; total: number; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const inMonth = data.sales.filter((s) => {
      const sd = new Date(s.createdAt);
      return sd >= d && sd < next;
    });
    months.push({
      label: d.toLocaleDateString("pt-BR", { month: "short" }),
      total: inMonth.reduce((a, s) => a + s.total, 0),
      count: inMonth.length,
    });
  }
  const maxTotal = Math.max(...months.map((m) => m.total), 1);

  // Top produtos por venda (mock baseado nos itens vendidos)
  const topProducts = data.products
    .map((p) => {
      const count = data.sales.reduce((acc, s) => acc + (s.productIds.includes(p.id) ? 1 : 0), 0);
      return { ...p, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Relatórios</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral dos números do seu negócio (somente neste dispositivo).</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Clientes" value={String(totalClientes)} hint={`${vips} VIP`} />
        <Stat label="Vendas" value={String(totalVendas)} hint={`Ticket médio: ${formatBRL(ticketMedio * 100)}`} />
        <Stat label="Recebido" value={formatBRL(totalReceita * 100)} accent="ok" />
        <Stat label="Pendente" value={formatBRL(totalPendente * 100)} accent="warn" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="card-title mb-4">Vendas por mês (últimos 6)</h2>
          <div className="space-y-2">
            {months.map((m) => (
              <div key={m.label} className="flex items-center gap-3">
                <span className="w-12 text-xs text-gray-500 capitalize">{m.label}</span>
                <div className="flex-1 h-6 rounded-md bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-[#1d5c3a]"
                    style={{ width: `${(m.total / maxTotal) * 100}%` }}
                  />
                </div>
                <span className="w-28 text-right text-sm font-semibold text-gray-700">
                  {formatBRL(m.total * 100)} · {m.count} vendas
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title mb-4">Top produtos</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-500">Sem produtos vinculados a vendas ainda.</p>
          ) : (
            <ol className="space-y-2">
              {topProducts.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                    <span className="font-medium text-gray-800">{p.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-[#1d5c3a]">{p.count} venda(s)</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "ok" | "warn";
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent === "ok" ? "text-emerald-700" : accent === "warn" ? "text-amber-700" : "text-gray-800"}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
