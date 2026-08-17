"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/ui";
import { LoadingState, ErrorState, Toast, confirmDialog } from "@/components/crm/crm-ui";
import { formatBRL } from "@/lib/utils";
import { exportPdfAll, exportCsvAll, fetchCrmBundle } from "@/lib/crm-export";
import type { CrmDashboardStats, CrmSettings, CrmWhatsAppConfig } from "@/types";

interface Props {
  initialStats: CrmDashboardStats | null;
  initialSettings: CrmSettings | null;
  initialWhatsApp: CrmWhatsAppConfig | null;
}

export default function CrmDashboard({ initialStats, initialSettings, initialWhatsApp }: Props) {
  const [stats, setStats] = useState<CrmDashboardStats | null>(initialStats);
  const [settings, setSettings] = useState<CrmSettings | null>(initialSettings);
  const [loading, setLoading] = useState(!initialStats);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/crm/stats");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar.");
      setStats(json.stats);
      setSettings(json.settings);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar o CRM.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialStats) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <LoadingState label="Carregando seu CRM..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return null;

  const finEnabled = settings?.modules?.financeiro !== false;
  const cobEnabled = settings?.modules?.cobrancas !== false;
  const fidelidadeEnabled = settings?.modules?.fidelidade !== false;
  const maxRevenue = Math.max(1, ...stats.revenueByMonth.map((r) => r.total_cents));

  async function handleExport(kind: "pdf" | "csv") {
    if (!confirmDialog(`Exportar ${kind === "pdf" ? "o relatório em PDF" : "os arquivos CSV (backup)"} com seus dados?`)) return;
    setExporting(true);
    setToast(null);
    try {
      const bundle = await fetchCrmBundle();
      if (kind === "pdf") {
        await exportPdfAll(bundle);
        setToast({ ok: true, text: "PDF gerado com sucesso!" });
      } else {
        exportCsvAll(bundle);
        setToast({ ok: true, text: "Arquivos CSV gerados! Verifique seus downloads." });
      }
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao exportar." });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <Toast msg={toast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Olá, {stats.consultantName || "Consultor(a)"} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Resumo do seu negócio. Acesse os módulos pelo menu acima.
            {initialWhatsApp && !initialWhatsApp.enabled && (
              <span className="ml-2 text-amber-600">· WhatsApp não configurado</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-outline text-xs" onClick={() => handleExport("pdf")} disabled={exporting}>
            {exporting ? "Gerando..." : "📄 Exportar PDF"}
          </button>
          <button className="btn btn-outline text-xs" onClick={() => handleExport("csv")} disabled={exporting}>
            {exporting ? "Gerando..." : "💾 Exportar meus dados"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Clientes ativos" value={stats.activeClients} icon="👥" sub={`${stats.vipClients} VIP`} />
        <StatCard label="Vendas do mês" value={stats.monthSales} icon="🛒" />
        <StatCard label="Faturamento do mês" value={formatBRL(stats.monthRevenueCents)} icon="💰" />
        {cobEnabled && (
          <StatCard
            label="Valores a receber"
            value={formatBRL(stats.receivableCents)}
            icon="🧾"
            sub={`${stats.pendingCharges} pendentes · ${stats.overdueCharges} vencidas`}
          />
        )}
        {finEnabled && (
          <StatCard label="Clientes sem contato" value={stats.clientsWithoutRecentContact} icon="⏰" sub="há mais de 30 dias" />
        )}
        <StatCard label="Próximos aniversários" value={stats.upcomingBirthdays.length} icon="🎂" />
        <StatCard label="Próximas tarefas" value={stats.upcomingTasks.filter((t) => t.status !== "Concluída").length} icon="✅" />
      </div>

      {/* Gráfico de faturamento */}
      <div className="card mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="card-title mb-0">Faturamento dos últimos 6 meses</h2>
          <Link href="/painel/crm/relatorios" className="text-xs text-[#1d5c3a] underline">Ver relatórios</Link>
        </div>
        <div className="flex items-end gap-2 h-40">
          {stats.revenueByMonth.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <span className="text-[0.6rem] text-gray-400 font-medium" title={formatBRL(m.total_cents)}>
                {formatBRL(m.total_cents)}
              </span>
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-[#1d5c3a] to-[#4a9e6b]"
                style={{ height: `${Math.max(4, (m.total_cents / maxRevenue) * 100)}%` }}
              />
              <span className="text-[0.6rem] text-gray-500">{m.month}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Clientes VIP */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="card-title mb-0">⭐ Clientes VIP</h2>
            <Link href="/painel/crm/clientes?onlyVip=1" className="text-xs text-[#1d5c3a] underline">Ver todos</Link>
          </div>
          {stats.vipClientsList.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">Nenhum cliente VIP ainda. As regras de VIP são definidas nas Configurações.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {stats.vipClientsList.map((c) => (
                <li key={c.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <Link href={`/painel/crm/clientes/${c.id}`} className="text-sm font-medium text-gray-800 hover:text-[#1d5c3a]">{c.name}</Link>
                    <p className="text-xs text-gray-400">{c.purchase_count} compras · {formatBRL(c.total_spent_cents || 0)}</p>
                  </div>
                  <span className="text-xs text-gray-400">{formatBRL(c.ticket_avg_cents || 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Próximas tarefas */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="card-title mb-0">📌 Próximas tarefas</h2>
            <Link href="/painel/crm/tarefas" className="text-xs text-[#1d5c3a] underline">Gerenciar</Link>
          </div>
          {stats.upcomingTasks.filter((t) => t.status !== "Concluída").length === 0 ? (
            <p className="text-sm text-gray-400 py-4">Nenhuma tarefa pendente. Crie lembretes na aba Tarefas.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {stats.upcomingTasks.filter((t) => t.status !== "Concluída").slice(0, 5).map((t) => (
                <li key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                    <p className="text-xs text-gray-400">
                      {t.client_name ? `${t.client_name} · ` : ""}
                      {t.due_date ? new Date(t.due_date + "T00:00:00").toLocaleDateString("pt-BR") : "Sem data"}
                      {t.due_time ? ` · ${t.due_time}` : ""}
                    </p>
                  </div>
                  <span className={`badge ${t.priority === "Urgente" ? "badge-red" : t.priority === "Alta" ? "badge-yellow" : "badge-gray"}`}>{t.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Clientes que precisam de atenção */}
      <div className="card mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="card-title mb-0">⏰ Clientes que precisam de atenção</h2>
          <Link href="/painel/crm/clientes?noContact=1" className="text-xs text-[#1d5c3a] underline">Filtrar sem contato</Link>
        </div>
        {stats.needsAttention.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Todos os clientes estão em dia. Nada para fazer aqui! 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Categoria</th>
                  <th>Última compra</th>
                  <th>Compras</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.needsAttention.slice(0, 8).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/painel/crm/clientes/${c.id}`} className="text-[#1d5c3a] hover:underline">{c.name}</Link>
                    </td>
                    <td>{c.category}</td>
                    <td>{c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString("pt-BR") : "Nunca comprou"}</td>
                    <td>{c.purchase_count || 0}</td>
                    <td>{formatBRL(c.total_spent_cents || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}