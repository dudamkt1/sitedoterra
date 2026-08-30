"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CrmModal, EmptyState, LoadingState, ErrorState, Toast, Field, apiPost, apiDelete, confirmDialog, CrmStatusBadge } from "@/components/crm/crm-ui";
import { formatBRL } from "@/lib/utils";
import { SALE_STATUSES, SALE_STATUS_COLORS } from "@/lib/crm-shared";
import type { CrmSale, CrmClient, CrmProduct } from "@/types";

export default function CrmSales() {
  const [sales, setSales] = useState<CrmSale[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const [clients, setClients] = useState<CrmClient[]>([]);
  const [products, setProducts] = useState<CrmProduct[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_id: "", sale_date: "", status: "Pago", payment_method: "", notes: "", items: [] as { product_id: string; product_name: string; quantity: number; unit_price_cents: number }[] });
  const [saving, setSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
      if (statusFilter) params.set("status", statusFilter);
      if (clientFilter) params.set("clientId", clientFilter);
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("clientId")) params.set("clientId", sp.get("clientId")!);
      const res = await fetch(`/api/crm/sales?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar vendas.");
      setSales(json.sales);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar vendas.");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, statusFilter, clientFilter]);

  useEffect(() => {
    Promise.all([
      fetch("/api/crm/clients?perPage=100").then((r) => r.json()),
      fetch("/api/crm/products").then((r) => r.json()),
    ]).then(([c, p]) => {
      setClients(c.clients || []);
      setProducts(p.products || []);
    }).catch(() => {});
  }, []);

  async function openCreate() {
    const sp = new URLSearchParams(window.location.search);
    setForm({ client_id: sp.get("clientId") || "", sale_date: new Date().toISOString().slice(0, 10), status: "Pago", payment_method: "", notes: "", items: [] });
    setShowForm(true);
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { product_id: "", product_name: "", quantity: 1, unit_price_cents: 0 }] }));
  }
  function updateItem(idx: number, patch: Partial<{ product_id: string; product_name: string; quantity: number; unit_price_cents: number }>) {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  }
  function pickProduct(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    updateItem(idx, p ? { product_id: p.id, product_name: p.name, unit_price_cents: p.price_cents } : { product_id: productId });
  }

  const subtotal = form.items.reduce((s, it) => s + it.quantity * it.unit_price_cents, 0);

  async function saveSale() {
    setSaving(true);
    try {
      const items = form.items.filter((it) => it.unit_price_cents > 0 && it.product_name);
      if (!items.length) throw new Error("Adicione pelo menos um item com valor.");
      await apiPost("/api/crm/sales", {
        client_id: form.client_id || null,
        sale_date: form.sale_date,
        status: form.status,
        payment_method: form.payment_method,
        notes: form.notes,
        items,
      });
      setToast({ ok: true, text: "Venda registrada com sucesso!" });
      setShowForm(false);
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao registrar venda." });
    } finally {
      setSaving(false);
    }
  }

  async function removeSale(s: CrmSale) {
    if (!confirmDialog(`Excluir a venda de ${formatBRL(s.total_cents)}?`)) return;
    try {
      await apiDelete(`/api/crm/sales/${s.id}`);
      setToast({ ok: true, text: "Venda excluída." });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao excluir." });
    }
  }

  const monthTotal = sales.filter((s) => s.status !== "Cancelado" && s.status !== "Reembolsado").reduce((a, s) => a + s.total_cents, 0);

  return (
    <div>
      <Toast msg={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Vendas</h1>
          <p className="text-sm text-gray-500 mt-1">{total} vendas registradas · visíveis nesta página {formatBRL(monthTotal)}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Registrar venda</button>
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {SALE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Cliente</label>
            <select className="input" value={clientFilter} onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Carregando vendas..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : sales.length === 0 ? (
        <div className="card">
          <EmptyState icon="🛒" title="Você ainda não possui vendas neste período." sub="Registre uma venda selecionando o cliente e os produtos." action={<button className="btn btn-primary" onClick={openCreate}>+ Registrar primeira venda</button>} />
        </div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Data</th><th>Cliente</th><th>Produtos</th><th>Desconto</th><th>Total</th><th>Pagamento</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.sale_date).toLocaleDateString("pt-BR")}</td>
                    <td>
                      {s.client_id ? <Link href={`/painel/crm/clientes/${s.client_id}`} className="text-[#1d5c3a] hover:underline">{s.client_name}</Link> : <span className="text-gray-400">Sem cliente</span>}
                    </td>
                    <td className="text-sm max-w-xs">{(s.items || []).map((i) => `${i.product_name} x${i.quantity}`).join(", ") || "—"}</td>
                    <td>{s.discount_cents ? formatBRL(s.discount_cents) : "—"}</td>
                    <td className="font-medium">{formatBRL(s.total_cents)}</td>
                    <td className="text-sm text-gray-500">{s.payment_method || "—"}</td>
                    <td><CrmStatusBadge value={s.status} colorMap={SALE_STATUS_COLORS} /></td>
                    <td><button className="text-red-500 text-sm px-1" onClick={() => removeSale(s)}>🗑</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button className="btn btn-outline text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Anterior</button>
              <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
              <button className="btn btn-outline text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima →</button>
            </div>
          )}
        </>
      )}

      {showForm && (
        <CrmModal
          title="+ Registrar venda"
          onClose={() => setShowForm(false)}
          wide
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={saveSale}>
                {saving ? "Salvando..." : "Registrar venda"}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Field label="Cliente">
              <select className="input" value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
                <option value="">Sem cliente</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Data">
              <input type="date" className="input" value={form.sale_date} onChange={(e) => setForm((f) => ({ ...f, sale_date: e.target.value }))} />
            </Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {SALE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Produtos da venda</label>
            <button type="button" className="btn btn-outline !py-1 !px-3 !text-xs" onClick={addItem}>+ Adicionar produto</button>
          </div>
          <div className="space-y-2 mb-4">
            {form.items.length === 0 && <p className="text-sm text-gray-400">Nenhum item. Clique em &quot;+ Adicionar produto&quot;.</p>}
            {form.items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-gray-100 bg-gray-50 p-2">
                <select className="input col-span-5 !py-1.5" value={it.product_id} onChange={(e) => pickProduct(idx, e.target.value)}>
                  <option value="">Escolher produto do catálogo</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatBRL(p.price_cents)}</option>)}
                </select>
                <input className="input col-span-3 !py-1.5" placeholder="Descrição (avulso)" value={it.product_name} onChange={(e) => updateItem(idx, { product_name: e.target.value })} />
                <input type="number" className="input col-span-1 !py-1.5" min="1" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value)) })} />
                <input type="number" className="input col-span-2 !py-1.5" placeholder="R$/unid" value={it.unit_price_cents ? (it.unit_price_cents / 100).toFixed(2) : ""} onChange={(e) => updateItem(idx, { unit_price_cents: Math.round(parseFloat(e.target.value) * 100 || 0) })} />
                <button type="button" className="text-red-500 text-sm col-span-1" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}>✕</button>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
              <Field label="Forma de pagamento">
                <select className="input" value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}>
                  <option value="">—</option>
                  <option value="Pix">Pix</option>
                  <option value="Cartão de crédito">Cartão de crédito</option>
                  <option value="Cartão de débito">Cartão de débito</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Boleto">Boleto</option>
                </select>
              </Field>
              <Field label="Observações"><input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase">Total da venda</p>
              <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{formatBRL(subtotal)}</p>
            </div>
          </div>
        </CrmModal>
      )}
    </div>
  );
}