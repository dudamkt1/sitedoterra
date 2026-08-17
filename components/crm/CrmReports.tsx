"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoadingState, ErrorState, Toast } from "@/components/crm/crm-ui";
import { formatBRL } from "@/lib/utils";
import { exportPdfAll, exportCsvAll, fetchCrmBundle } from "@/lib/crm-export";
import type { CrmSale, CrmFinancialEntry, CrmProduct, CrmClient } from "@/types";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export default function CrmReports() {
  const [period, setPeriod] = useState<"mes" | "trimestre" | "ano" | "tudo">("mes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sales, setSales] = useState<CrmSale[]>([]);
  const [financial, setFinancial] = useState<CrmFinancialEntry[]>([]);
  const [products, setProducts] = useState<CrmProduct[]>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);

  const now = new Date();
  const range: { from: string; to: string } | null =
    period === "mes"
      ? { from: monthKey(now) + "-01", to: now.toISOString().slice(0, 10) }
      : period === "trimestre"
        ? { from: monthKey(addMonths(now, -2)) + "-01", to: now.toISOString().slice(0, 10) }
        : period === "ano"
          ? { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) }
          : null;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (range) {
        params.set("from", range.from);
        params.set("to", range.to);
      }
      const [s, f, p, c] = await Promise.all([
        fetch(`/api/crm/sales?${params}&perPage=100`).then((r) => r.json()),
        fetch(`/api/crm/financial?${params}`).then((r) => r.json()),
        fetch("/api/crm/products?all=1").then((r) => r.json()),
        fetch("/api/crm/clients?perPage=100").then((r) => r.json()),
      ]);
      setSales(s.sales || []);
      setFinancial(f.entries || []);
      setProducts(p.products || []);
      setClients(c.clients || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar relatórios.");
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [period]);

  if (loading) return <LoadingState label="Gerando relatórios..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const activeSales = sales.filter((s) => s.status !== "Cancelado" && s.status !== "Reembolsado");
  const revenue = activeSales.reduce((a, s) => a + s.total_cents, 0);
  const income = financial.filter((f) => f.type === "income").reduce((a, f) => a + f.amount_cents, 0);
  const expense = financial.filter((f) => f.type === "expense").reduce((a, f) => a + f.amount_cents, 0);
  const avgTicket = activeSales.length ? Math.round(revenue / activeSales.length) : 0;

  // Gráfico mensal
  const monthMap = new Map<string, { label: string; total: number; sales: number }>();
  for (const s of activeSales) {
    const k = (s.sale_date || "").slice(0, 7);
    if (!k) continue;
    const cur = monthMap.get(k) || { label: k, total: 0, sales: 0 };
    cur.total += s.total_cents;
    cur.sales += 1;
    monthMap.set(k, cur);
  }
  const months = Array.from(monthMap.values()).sort((a, b) => a.label.localeCompare(b.label)).slice(-6);
  const maxRev = Math.max(1, ...months.map((m) => m.total));

  // Produtos mais vendidos
  const prodMap = new Map<string, { name: string; units: number; cents: number }>();
  for (const s of activeSales) {
    for (const it of s.items || []) {
      const cur = prodMap.get(it.product_name) || { name: it.product_name, units: 0, cents: 0 };
      cur.units += it.quantity;
      cur.cents += it.total_cents;
      prodMap.set(it.product_name, cur);
    }
  }
  const topProducts = Array.from(prodMap.values()).sort((a, b) => b.cents - a.cents).slice(0, 10);

  // Indicadores de clientes
  const vipList = [...clients].filter((c) => c.is_vip).sort((a, b) => (b.total_spent_cents || 0) - (a.total_spent_cents || 0)).slice(0, 10);
  const withPurchases = clients.filter((c) => (c.purchase_count || 0) > 0);
  const recurring = clients.filter((c) => (c.purchase_count || 0) >= 2);
  const inactive = clients.filter((c) => c.category === "Cliente inativo" || c.category === "Cliente perdido");
  const repurchaseRate = clients.length ? Math.round((recurring.length / Math.max(1, withPurchases.length)) * 100) : 0;
  const revenuePerClient = clients.length ? Math.round(revenue / clients.length) : 0;

  async function handlePdf() {
    setExporting(true);
    setToast(null);
    try {
      const bundle = await fetchCrmBundle();
      await exportPdfAll(bundle);
      setToast({ ok: true, text: "Relatório PDF gerado!" });
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao exportar." });
    } finally {
      setExporting(false);
    }
  }

  const indicatorCards = [
    { label: "Faturamento", value: formatBRL(revenue), icon: "💰" },
    { label: "Vendas", value: activeSales.length, icon: "🛒" },
    { label: "Ticket médio", value: formatBRL(avgTicket), icon: "🎫" },
    { label: "Novos clientes", value: clients.length, icon: "🆕" },
    { label: "Recorrentes (2+ compras)", value: recurring.length, icon: "🔁" },
    { label: "Taxa de recompra", value: `${repurchaseRate}%`, icon: "📈" },
    { label: "Inativos", value: inactive.length, icon: "😴" },
    { label: "Faturamento por cliente", value: formatBRL(revenuePerClient), icon: "👤" },
    { label: "Entradas", value: formatBRL(income), icon: "⬆️" },
    { label: "Saídas", value: formatBRL(expense), icon: "⬇️" },
    { label: "Resultado", value: formatBRL(income - expense), icon: "⚖️" },
    { label: "Produtos com maior venda", value: topProducts[0]?.name || "—", icon: "🏆" },
  ];

  return (
    <div>
      <Toast msg={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Relatórios</h1>
          <p className="text-sm text-gray-500 mt-1">Indicadores do seu negócio.</p>
        </div>
        <button className="btn btn-outline text-xs" disabled={exporting} onClick={handlePdf}>
          {exporting ? "Gerando..." : "📄 Exportar relatório em PDF"}
        </button>
      </div>

      <div className="card mb-6">
        <label className="label">Período</label>
        <div className="flex gap-2 flex-wrap">
          {([
            ["mes", "Este mês"],
            ["trimestre", "Últimos 3 meses"],
            ["ano", "Este ano"],
            ["tudo", "Todo o período"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`badge !px-4 !py-2 cursor-pointer ${period === key ? "bg-[#1d5c3a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {indicatorCards.map((c) => (
          <div key={c.label} className="card">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{c.label}</p>
              <span>{c.icon}</span>
            </div>
            <p className="mt-2 text-xl font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6">
        <h2 className="card-title mb-4">Faturamento por mês</h2>
        {months.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Você ainda não possui vendas neste período.</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {months.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[0.6rem] text-gray-400">{formatBRL(m.total)}</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-[#1d5c3a] to-[#4a9e6b]" style={{ height: `${Math.max(4, (m.total / maxRev) * 100)}%` }} />
                <span className="text-[0.6rem] text-gray-500">{m.label.slice(5)}/{m.label.slice(2, 4)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="card">
          <h2 className="card-title mb-3">Produtos mais vendidos</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">Nenhum produto vendido no período.</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-center font-semibold text-gray-400">{i + 1}º</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.units} unidades</p>
                  </div>
                  <span className="font-medium">{formatBRL(p.cents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="card-title mb-3">⭐ Clientes VIP</h2>
          {vipList.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">Nenhum cliente VIP no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr><th>Cliente</th><th>Compras</th><th>Total</th><th>Ticket</th><th>Última compra</th></tr>
                </thead>
                <tbody>
                  {vipList.map((c) => (
                    <tr key={c.id}>
                      <td><Link href={`/painel/crm/clientes/${c.id}`} className="text-[#1d5c3a] hover:underline">{c.name}</Link></td>
                      <td>{c.purchase_count || 0}</td>
                      <td className="font-medium">{formatBRL(c.total_spent_cents || 0)}</td>
                      <td>{formatBRL(c.ticket_avg_cents || 0)}</td>
                      <td>{c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString("pt-BR") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}