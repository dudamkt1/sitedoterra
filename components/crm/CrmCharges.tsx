"use client";

import { useEffect, useState } from "react";
import { CrmModal, EmptyState, LoadingState, ErrorState, Toast, Field, apiPost, apiPut, apiDelete, confirmDialog, CrmStatusBadge } from "@/components/crm/crm-ui";
import { formatBRL } from "@/lib/utils";
import { CHARGE_STATUSES, CHARGE_STATUS_COLORS } from "@/lib/crm-shared";
import type { CrmCharge, CrmClient, CrmSale } from "@/types";

export default function CrmCharges() {
  const [charges, setCharges] = useState<CrmCharge[]>([]);
  const [summary, setSummary] = useState({ toReceive: 0, received: 0, overdue: 0, upcoming: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [sales, setSales] = useState<CrmSale[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "25" });
      if (statusFilter) params.set("status", statusFilter);
      if (clientFilter) params.set("clientId", clientFilter);
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("clientId")) params.set("clientId", sp.get("clientId")!);
      const res = await fetch(`/api/crm/charges?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar.");
      setCharges(json.charges);
      setSummary(json.summary);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, statusFilter, clientFilter]);

  useEffect(() => {
    Promise.all([
      fetch("/api/crm/clients?perPage=100").then((r) => r.json()),
      fetch("/api/crm/sales?perPage=100").then((r) => r.json()),
    ]).then(([c, s]) => {
      setClients(c.clients || []);
      setSales(s.sales || []);
    }).catch(() => {});
  }, []);

  function openCreate() {
    const sp = new URLSearchParams(window.location.search);
    setForm({ client_id: sp.get("clientId") || "", sale_id: "", amount: "", due_date: new Date().toISOString().slice(0, 10), payment_method: "", notes: "" });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      const amountCents = Math.round(parseFloat(form.amount.replace(",", ".")) * 100 || 0);
      if (!amountCents) throw new Error("Informe um valor válido.");
      await apiPost("/api/crm/charges", { client_id: form.client_id || null, sale_id: form.sale_id || null, amount_cents: amountCents, due_date: form.due_date, payment_method: form.payment_method, notes: form.notes });
      setToast({ ok: true, text: "Cobrança criada!" });
      setShowForm(false);
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(ch: CrmCharge, status: string) {
    try {
      await apiPut(`/api/crm/charges/${ch.id}`, { status });
      setToast({ ok: true, text: status === "Pago" ? "Cobrança marcada como paga!" : "Status atualizado." });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao atualizar." });
    }
  }

  async function remove(ch: CrmCharge) {
    if (!confirmDialog("Excluir esta cobrança?")) return;
    try {
      await apiDelete(`/api/crm/charges/${ch.id}`);
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao excluir." });
    }
  }

  return (
    <div>
      <Toast msg={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Cobranças</h1>
          <p className="text-sm text-gray-500 mt-1">Acompanhe o que seus clientes devem e o que já foi pago.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nova cobrança</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "A receber", value: summary.toReceive, icon: "🧾" },
          { label: "Recebido", value: summary.received, icon: "✅" },
          { label: "Vencido", value: summary.overdue, icon: "⛔" },
          { label: "Próximos vencimentos", value: summary.upcoming, icon: "📅" },
        ].map((s) => (
          <div key={s.label} className="card">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{s.label}</p>
              <span>{s.icon}</span>
            </div>
            <p className="mt-2 text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{formatBRL(s.value)}</p>
          </div>
        ))}
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {CHARGE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
        <LoadingState label="Carregando cobranças..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : charges.length === 0 ? (
        <div className="card">
          <EmptyState icon="🧾" title="Nenhuma cobrança encontrada." sub="Crie cobranças para acompanhar pagamentos dos seus clientes." />
        </div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Pagamento</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {charges.map((ch) => (
                  <tr key={ch.id}>
                    <td className="font-medium text-gray-800">{ch.client_name || "—"}</td>
                    <td>{new Date(ch.due_date).toLocaleDateString("pt-BR")}</td>
                    <td className="font-medium">{formatBRL(ch.amount_cents)}</td>
                    <td className="text-sm text-gray-500">{ch.payment_method || "—"}</td>
                    <td><CrmStatusBadge value={ch.status} colorMap={CHARGE_STATUS_COLORS} /></td>
                    <td className="whitespace-nowrap">
                      {ch.status === "Pendente" || ch.status === "Vencido" ? (
                        <button className="btn btn-outline !py-1 !px-2 !text-xs mr-1" onClick={() => setStatus(ch, "Pago")}>✓ Receber</button>
                      ) : (
                        <button className="btn btn-outline !py-1 !px-2 !text-xs mr-1" onClick={() => setStatus(ch, "Pendente")}>Reabrir</button>
                      )}
                      <button className="btn btn-outline !py-1 !px-2 !text-xs text-red-500" onClick={() => remove(ch)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button className="btn btn-outline text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
              <span className="text-sm text-gray-500">{page} / {totalPages}</span>
              <button className="btn btn-outline text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>→</button>
            </div>
          )}
        </>
      )}

      {showForm && (
        <CrmModal title="+ Nova cobrança" onClose={() => setShowForm(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Cliente *">
                <select className="input" value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Venda relacionada (opcional)">
              <select className="input" value={form.sale_id} onChange={(e) => setForm((f) => ({ ...f, sale_id: e.target.value }))}>
                <option value="">—</option>
                {sales.filter((s) => !form.client_id || s.client_id === form.client_id).map((s) => (
                  <option key={s.id} value={s.id}>{new Date(s.sale_date).toLocaleDateString("pt-BR")} — {s.client_name || "sem cliente"} ({formatBRL(s.total_cents)})</option>
                ))}
              </select>
            </Field>
            <Field label="Valor (R$) *">
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </Field>
            <Field label="Vencimento">
              <input type="date" className="input" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </Field>
            <Field label="Forma de pagamento">
              <select className="input" value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}>
                <option value="">—</option>
                <option value="Pix">Pix</option>
                <option value="Cartão">Cartão</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Boleto">Boleto</option>
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Observações"><input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving || !form.client_id || !form.amount} onClick={save}>{saving ? "Salvando..." : "Criar cobrança"}</button>
          </div>
        </CrmModal>
      )}
    </div>
  );
}