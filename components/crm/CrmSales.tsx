"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CrmModal, EmptyState, LoadingState, ErrorState, Toast, Field, apiPost, apiPut, apiDelete, confirmDialog, CrmStatusBadge } from "@/components/crm/crm-ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatBRL } from "@/lib/utils";
import { SALE_STATUSES, SALE_STATUS_COLORS } from "@/lib/crm-shared";
import type { CrmSale, CrmClient, CrmProduct } from "@/types";

type FormState = {
  client_id: string;
  sale_date: string;
  status: string;
  payment_method: string;
  notes: string;
  items: { product_id: string; product_name: string; quantity: number; unit_price_cents: number }[];
};

const EMPTY_FORM: FormState = {
  client_id: "",
  sale_date: "",
  status: "Pago",
  payment_method: "",
  notes: "",
  items: [],
};

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
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);

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

  function openCreate() {
    const sp = new URLSearchParams(window.location.search);
    setForm({
      ...EMPTY_FORM,
      client_id: sp.get("clientId") || "",
      sale_date: new Date().toISOString().slice(0, 10),
    });
    setEditingSaleId(null);
    setShowForm(true);
  }

  async function openEdit(s: CrmSale) {
    try {
      const res = await fetch(`/api/crm/sales/${s.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar venda.");
      const items = (json.items || []).map((it: { product_id: string | null; product_name: string; quantity: number; unit_price_cents: number }) => ({
        product_id: it.product_id || "",
        product_name: it.product_name || "",
        quantity: Math.max(1, Number(it.quantity) || 1),
        unit_price_cents: Math.round(Number(it.unit_price_cents) || 0),
      }));
      setForm({
        client_id: s.client_id || "",
        sale_date: s.sale_date || new Date().toISOString().slice(0, 10),
        status: s.status || "Pago",
        payment_method: s.payment_method || "",
        notes: s.notes || "",
        items,
      });
      setEditingSaleId(s.id);
      setShowForm(true);
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao abrir edição." });
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditingSaleId(null);
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
      const body = {
        client_id: form.client_id || null,
        sale_date: form.sale_date,
        status: form.status,
        payment_method: form.payment_method,
        notes: form.notes,
        items,
      };
      if (editingSaleId) {
        await apiPut(`/api/crm/sales/${editingSaleId}`, body);
        setToast({ ok: true, text: "Venda atualizada com sucesso!" });
      } else {
        await apiPost("/api/crm/sales", body);
        setToast({ ok: true, text: "Venda registrada com sucesso!" });
      }
      closeForm();
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar venda." });
    } finally {
      setSaving(false);
    }
  }

  async function removeSale(s: CrmSale) {
    if (!confirmDialog(`Excluir a venda de ${formatBRL(s.total_cents)}? Esta ação não pode ser desfeita.`)) return;
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
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#1d5c3a] hover:border-[#1d5c3a]/30 transition"
                          aria-label="Editar venda"
                          title="Editar venda"
                        >
                          ✏️ <span className="hidden sm:inline">Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSale(s)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-white px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 transition"
                          aria-label="Excluir venda"
                          title="Excluir venda"
                        >
                          🗑 <span className="hidden sm:inline">Excluir</span>
                        </button>
                      </div>
                    </td>
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
          title={editingSaleId ? "✏️ Editar venda" : "+ Registrar venda"}
          onClose={closeForm}
          wide
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={closeForm}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={saveSale}>
                {saving ? "Salvando..." : (editingSaleId ? "Salvar alterações" : "Registrar venda")}
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCatalogPicker(true)}
                disabled={products.length === 0}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#1d5c3a]/30 bg-[#eaf6ec] px-3 py-1.5 text-[12px] font-semibold text-[#103d28] hover:bg-[#d8efe1] transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Escolher um produto já cadastrado no catálogo"
              >
                📦 Selecionar do catálogo
              </button>
              <button type="button" className="btn btn-outline !py-1 !px-3 !text-xs" onClick={addItem}>+ Avulso</button>
            </div>
          </div>
          <div className="space-y-2 mb-4">
            {form.items.length === 0 && <p className="text-sm text-gray-400">Nenhum item. Clique em &quot;+ Adicionar produto&quot;.</p>}
            {form.items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-gray-100 bg-gray-50 p-2">
                <select className="input col-span-5 !py-1.5" value={it.product_id} onChange={(e) => pickProduct(idx, e.target.value)}>
                  <option value="">Escolher produto do catálogo</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatBRL(p.price_cents)}</option>)}
                </select>
                <input className="input col-span-2 !py-1.5" placeholder="Descrição (avulso)" value={it.product_name} onChange={(e) => updateItem(idx, { product_name: e.target.value })} />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="input col-span-1 !py-1.5 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="Qtd"
                  value={it.quantity}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D+/g, "").slice(0, 4);
                    updateItem(idx, { quantity: Math.max(1, Number(digits) || 1) });
                  }}
                />
                <div className="col-span-3">
                  <MoneyInput
                    className="input !py-1.5 w-full"
                    value={it.unit_price_cents}
                    onChange={(cents) => updateItem(idx, { unit_price_cents: cents })}
                    placeholder="R$ 0,00"
                    aria-label="Valor unitário"
                  />
                </div>
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

      {showCatalogPicker && (
        <CatalogPickerModal
          products={products}
          onClose={() => setShowCatalogPicker(false)}
          onPick={(p) => {
            setForm((f) => ({
              ...f,
              items: [
                ...f.items,
                {
                  product_id: p.id,
                  product_name: p.name,
                  quantity: 1,
                  unit_price_cents: p.price_cents,
                },
              ],
            }));
            setShowCatalogPicker(false);
            setToast({ ok: true, text: `${p.name} adicionado. Você pode ajustar preço e quantidade.` });
          }}
        />
      )}
    </div>
  );
}

function CatalogPickerModal({
  products,
  onClose,
  onPick,
}: {
  products: CrmProduct[];
  onClose: () => void;
  onPick: (p: CrmProduct) => void;
}) {
  const [q, setQ] = useState("");
  const active = products.filter((p) => p.active);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return active;
    return active.filter((p: CrmProduct) => [p.name, p.category || "", p.sku || ""].join(" ").toLowerCase().includes(s));
  }, [active, q]);

  return (
    <CrmModal title="📦 Selecionar do catálogo" onClose={onClose} wide>
      <div className="mb-3 relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa5a0]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar no catálogo..."
          autoFocus
          className="w-full rounded-[10px] border border-[#dde2dc] bg-white pl-9 pr-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
        />
      </div>
      <p className="text-[11.5px] text-[#6b7a72] mb-2">
        {filtered.length} produto{filtered.length === 1 ? "" : "s"} disponíve{filtered.length === 1 ? "l" : "is"}. Selecionar preenche nome, preço e descrição — você pode ajustar a venda.
      </p>
      {active.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[#cfd5cf] bg-white p-8 text-center">
          <p className="text-[14px] font-semibold text-[#0d3320]">Seu catálogo ainda não tem produtos ativos</p>
          <p className="text-[12.5px] text-[#6b7a72] mt-1">Cadastre produtos em <b>/painel/crm/catalogo</b> para usar aqui.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[#cfd5cf] bg-white p-6 text-center text-[13px] text-[#6b7a72]">
          Nenhum produto encontrado para &ldquo;{q}&rdquo;.
        </div>
      ) : (
        <ul className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-[10px] border border-[#e2e8e0] bg-white p-2.5 hover:border-[#1d5c3a]/40 hover:bg-[#f4faf5] transition"
            >
              <div className="w-12 h-12 rounded-[8px] bg-[#eaf6ec] border border-[#dde2dc] overflow-hidden shrink-0 flex items-center justify-center">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-lg text-[#1d5c3a]/40">📦</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#0d3320] truncate">{p.name}</p>
                <p className="text-[11.5px] text-[#6b7a72] truncate">
                  {p.category || "Sem categoria"}{p.sku ? ` · SKU ${p.sku}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[14px] font-bold text-[#0d3320]">{formatBRL(p.price_cents)}</p>
                <p className="text-[10.5px] text-[#6b7a72]">/ {p.unit || "un"}</p>
              </div>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="shrink-0 inline-flex items-center gap-1 rounded-[8px] bg-[#1d5c3a] hover:bg-[#164a2e] text-white text-[12px] font-semibold px-3 py-1.5 shadow-[0_4px_10px_rgba(29,92,58,0.18)] transition"
              >
                + Adicionar
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn btn-outline" onClick={onClose}>Fechar</button>
      </div>
    </CrmModal>
  );
}