"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  EmptyState,
  LoadingState,
  ErrorState,
  Toast,
  apiPost,
  confirmDialog,
} from "@/components/crm/crm-ui";
import { formatBRL } from "@/lib/utils";
import { RefreshCw, XCircle, Link2, CheckCircle2, Search } from "lucide-react";

type Order = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  product_name: string;
  payment_method: string;
  payment_status: "pending" | "paid" | "failed" | "refunded" | "cancelled";
  payment_id: string | null;
  final_price_cents: number;
  quantity: number;
  total_cents: number;
  crm_sale_id: string | null;
  created_at: string;
  paid_at: string | null;
};

type Summary = {
  counts: Record<string, number>;
  cents: Record<string, number>;
  synced: number;
  paidUnsynced: number;
};

const STATUS_META: Record<string, { label: string; pill: string }> = {
  pending: { label: "Pendente", pill: "bg-amber-50 text-amber-800 border-amber-200" },
  paid: { label: "Pago", pill: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  failed: { label: "Com falha", pill: "bg-red-50 text-red-700 border-red-200" },
  refunded: { label: "Reembolsado", pill: "bg-violet-50 text-violet-800 border-violet-200" },
  cancelled: { label: "Cancelado", pill: "bg-slate-100 text-slate-600 border-slate-200" },
};

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  mercadopago: "Mercado Pago",
  manual: "Manual",
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "pending", label: "Pendentes" },
  { value: "paid", label: "Pagos" },
  { value: "failed", label: "Com falha" },
  { value: "refunded", label: "Reembolsados" },
  { value: "cancelled", label: "Cancelados" },
];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function CrmCatalogPayments({ onSummary }: { onSummary?: (s: Summary) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedQ(q.trim());
    }, 450);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (methodFilter) params.set("method", methodFilter);
      if (debouncedQ) params.set("q", debouncedQ);
      const res = await fetch(`/api/crm/catalog-orders?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar pagamentos.");
      setOrders(json.orders || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
      setSummary(json.summary || null);
      if (json.summary) onSummary?.(json.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar pagamentos.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, methodFilter, debouncedQ]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "sync" | "cancel" | "refresh", confirmMsg?: string) {
    if (confirmMsg && !confirmDialog(confirmMsg)) return;
    setActing(`${action}:${id}`);
    try {
      const json = await apiPost(`/api/crm/catalog-orders/${id}/${action}`, {});
      if (action === "sync") setToast({ ok: true, text: "Venda criada no CRM! Pagos entram em Vendas e Relatórios." });
      else if (action === "cancel") setToast({ ok: true, text: "Pedido cancelado." });
      else setToast({ ok: true, text: json.mpStatus === "approved" ? "Pagamento confirmado e sincronizado!" : "Status atualizado junto ao Mercado Pago." });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro na operação." });
    } finally {
      setActing(null);
    }
  }

  async function syncAllPaid() {
    const targets = orders.filter((o) => o.payment_status === "paid" && !o.crm_sale_id);
    if (!targets.length) {
      setToast({ ok: true, text: "Nada para sincronizar: todos os pagos já estão no CRM." });
      return;
    }
    if (!confirmDialog(`Criar ${targets.length} venda(s) no CRM a partir dos pedidos pagos?`)) return;
    setBulkSyncing(true);
    let ok = 0;
    for (const o of targets) {
      try {
        await apiPost(`/api/crm/catalog-orders/${o.id}/sync`, {});
        ok += 1;
      } catch {
        // segue para os próximos; o resumo final mostra o resultado
      }
    }
    setBulkSyncing(false);
    setToast({ ok: ok > 0, text: ok > 0 ? `${ok} venda(s) criada(s) no CRM!` : "Nenhuma venda pôde ser criada." });
    load();
  }

  return (
    <div>
      <Toast msg={toast} />

      {/* Resumo sincronizado com o CRM */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Recebido (pagos)</p>
            <p className="text-[22px] font-extrabold text-emerald-800 mt-1">{formatBRL(summary.cents.paid || 0)}</p>
            <p className="text-[12px] text-emerald-700 mt-0.5">{summary.counts.paid || 0} pagamento(s)</p>
          </div>
          <div className="rounded-[14px] border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">A receber (pendentes)</p>
            <p className="text-[22px] font-extrabold text-amber-800 mt-1">{formatBRL(summary.cents.pending || 0)}</p>
            <p className="text-[12px] text-amber-700 mt-0.5">{summary.counts.pending || 0} pagamento(s)</p>
          </div>
          <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7a72]">Falhas + cancelados</p>
            <p className="text-[22px] font-extrabold text-slate-700 mt-1">
              {(summary.counts.failed || 0) + (summary.counts.cancelled || 0) + (summary.counts.refunded || 0)}
            </p>
            <p className="text-[12px] text-slate-500 mt-0.5">
              {summary.counts.failed || 0} falha(s) · {summary.counts.refunded || 0} reembolso(s)
            </p>
          </div>
          <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7a72]">No CRM</p>
            <p className="text-[22px] font-extrabold text-[#0d3320] mt-1">{summary.synced} venda(s)</p>
            {summary.paidUnsynced > 0 ? (
              <button
                type="button"
                onClick={syncAllPaid}
                disabled={bulkSyncing}
                className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-[#1d5c3a] hover:underline disabled:opacity-50"
              >
                <Link2 className="h-3.5 w-3.5" />
                {bulkSyncing ? "Sincronizando..." : `Sincronizar ${summary.paidUnsynced} pago(s)`}
              </button>
            ) : (
              <p className="text-[12px] text-emerald-700 mt-1.5 inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Tudo sincronizado
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-4 sm:p-5 mb-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <label className="block text-[11px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9aa5a0]" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome do cliente…"
                className="w-full rounded-[10px] border border-[#dde2dc] bg-white pl-9 pr-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
              />
            </div>
          </div>
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
              className="w-full rounded-[10px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Método</label>
            <select
              value={methodFilter}
              onChange={(e) => { setPage(1); setMethodFilter(e.target.value); }}
              className="w-full rounded-[10px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
            >
              <option value="">Todos</option>
              <option value="pix">PIX</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Carregando pagamentos..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : orders.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="💳"
            title="Nenhum pagamento encontrado"
            sub="Quando clientes comprarem pelo catálogo (PIX ou Mercado Pago), os pedidos aparecem aqui com o status sincronizado."
          />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((o) => {
              const meta = STATUS_META[o.payment_status] || STATUS_META.pending;
              const busy = acting !== null;
              return (
                <article
                  key={o.id}
                  className="rounded-[14px] border border-[#e2e8e0] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${meta.pill}`}>
                          {meta.label}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {METHOD_LABEL[o.payment_method] || o.payment_method}
                        </span>
                        {o.crm_sale_id ? (
                          <Link
                            href="/painel/crm/vendas"
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:underline"
                            title="Ver no CRM"
                          >
                            <CheckCircle2 className="h-3 w-3" /> No CRM
                          </Link>
                        ) : o.payment_status === "paid" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            Fora do CRM
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-[15px] font-bold text-[#0d3320] truncate">
                        {o.customer_name}
                        <span className="ml-2 font-normal text-slate-500 text-[13px]">
                          {o.product_name} · {o.quantity}x
                        </span>
                      </p>
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        {[o.customer_email, o.customer_phone].filter(Boolean).join(" · ") || "Sem contato"} · {fmtDate(o.created_at)}
                        {o.paid_at ? ` · pago em ${fmtDate(o.paid_at)}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[19px] font-extrabold text-[#0d3320] tracking-tight">{formatBRL(o.total_cents)}</p>
                      <p className="text-[11px] text-slate-400 font-mono">#{o.id.slice(0, 8)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {o.payment_status === "paid" && !o.crm_sale_id && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(o.id, "sync")}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11.5px] font-bold text-emerald-800 hover:bg-emerald-100 transition disabled:opacity-50"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {acting === `sync:${o.id}` ? "Sincronizando..." : "Criar venda no CRM"}
                      </button>
                    )}
                    {o.payment_id && ["pending", "failed"].includes(o.payment_status) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(o.id, "refresh")}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                        title="Consulta o status real no Mercado Pago"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {acting === `refresh:${o.id}` ? "Consultando..." : "Atualizar status"}
                      </button>
                    )}
                    {["pending", "failed"].includes(o.payment_status) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(o.id, "cancel", `Cancelar o pedido de "${o.customer_name}" (${formatBRL(o.total_cents)})?`)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-white px-2 py-1 text-[11.5px] font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {acting === `cancel:${o.id}` ? "Cancelando..." : "Cancelar"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-[13px] text-slate-500">
            <span>{total} pagamento(s)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="tabular-nums">Página {page} de {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
              >
                Próxima →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
