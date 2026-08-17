"use client";

import { useEffect, useState } from "react";
import { CrmModal, EmptyState, LoadingState, ErrorState, Toast, Field, apiPost, apiPut, apiDelete, confirmDialog } from "@/components/crm/crm-ui";
import { formatBRL } from "@/lib/utils";
import type { CrmFinancialEntry, CrmClient } from "@/types";

export default function CrmFinancial({ categories }: { categories?: { income: string[]; expense: string[] } }) {
  const [entries, setEntries] = useState<CrmFinancialEntry[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, result: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CrmFinancialEntry | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [typeFilter, setTypeFilter] = useState("");

  const incomeCats = categories?.income?.length ? categories.income : ["Vendas", "Outros recebimentos"];
  const expenseCats = categories?.expense?.length ? categories.expense : ["Despesas", "Custos", "Outros gastos"];

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "25" });
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/crm/financial?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar.");
      setEntries(json.entries);
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
  useEffect(() => { load(); }, [page, typeFilter]);

  useEffect(() => {
    fetch("/api/crm/clients?perPage=100").then((r) => r.json()).then((json) => setClients(json.clients || [])).catch(() => {});
  }, []);

  function openCreate(type: "income" | "expense") {
    setEditing(null);
    setForm({ type, category: type === "income" ? incomeCats[0] : expenseCats[0], description: "", amount: "", entry_date: new Date().toISOString().slice(0, 10), payment_method: "", client_id: "", notes: "" });
    setShowForm(true);
  }
  function openEdit(e: CrmFinancialEntry) {
    setEditing(e);
    setForm({ type: e.type, category: e.category || "", description: e.description || "", amount: (e.amount_cents / 100).toFixed(2).replace(".", ","), entry_date: e.entry_date, payment_method: e.payment_method || "", client_id: e.client_id || "", notes: e.notes || "" });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      const amountCents = Math.round(parseFloat(form.amount.replace(",", ".")) * 100 || 0);
      if (!amountCents) throw new Error("Informe um valor válido.");
      const body = { ...form, amount_cents: amountCents, client_id: form.client_id || null };
      if (editing) {
        await apiPut(`/api/crm/financial/${editing.id}`, body);
        setToast({ ok: true, text: "Lançamento atualizado!" });
      } else {
        await apiPost("/api/crm/financial", body);
        setToast({ ok: true, text: "Lançamento registrado!" });
      }
      setShowForm(false);
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function remove(e: CrmFinancialEntry) {
    if (!confirmDialog("Excluir este lançamento?")) return;
    try {
      await apiDelete(`/api/crm/financial/${e.id}`);
      load();
    } catch (err) {
      setToast({ ok: false, text: err instanceof Error ? err.message : "Erro ao excluir." });
    }
  }

  const catOptions = form.type === "expense" ? expenseCats : incomeCats;

  return (
    <div>
      <Toast msg={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Financeiro</h1>
          <p className="text-sm text-gray-500 mt-1">Controle suas entradas e saídas.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => openCreate("income")}>+ Entrada</button>
          <button className="btn btn-outline" onClick={() => openCreate("expense")}>− Saída</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Entradas", value: summary.income, cls: "text-green-600" },
          { label: "Saídas", value: summary.expense, cls: "text-red-600" },
          { label: "Resultado", value: summary.result, cls: summary.result >= 0 ? "text-[#1d5c3a]" : "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{s.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${s.cls}`} style={{ fontFamily: "var(--font-display)" }}>{formatBRL(s.value)}</p>
          </div>
        ))}
      </div>

      <div className="card mb-4">
        <label className="label">Filtrar por tipo</label>
        <select className="input" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">Todos</option>
          <option value="income">Entradas</option>
          <option value="expense">Saídas</option>
        </select>
      </div>

      {loading ? (
        <LoadingState label="Carregando lançamentos..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : entries.length === 0 ? (
        <div className="card">
          <EmptyState icon="💰" title="Você ainda não possui lançamentos neste período." sub="Registre suas entradas (vendas, outros recebimentos) e saídas (despesas, custos)." />
        </div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Cliente</th><th>Valor</th><th></th></tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.entry_date).toLocaleDateString("pt-BR")}</td>
                    <td><span className={`badge ${e.type === "income" ? "badge-green" : "badge-red"}`}>{e.type === "income" ? "Entrada" : "Saída"}</span></td>
                    <td className="text-sm text-gray-500">{e.category || "—"}</td>
                    <td className="text-sm max-w-xs">{e.description || "—"}</td>
                    <td className="text-sm text-gray-500">{e.client_name || "—"}</td>
                    <td className={`font-medium ${e.type === "income" ? "text-green-600" : "text-red-600"}`}>{formatBRL((e.type === "income" ? 1 : -1) * e.amount_cents)}</td>
                    <td className="whitespace-nowrap">
                      <button className="btn btn-outline !py-1 !px-2 !text-xs mr-1" onClick={() => openEdit(e)}>Editar</button>
                      <button className="btn btn-outline !py-1 !px-2 !text-xs text-red-500" onClick={() => remove(e)}>🗑</button>
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
        <CrmModal title={editing ? "✏️ Editar lançamento" : form.type === "expense" ? "− Nova saída" : "+ Nova entrada"} onClose={() => setShowForm(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, category: e.target.value === "expense" ? expenseCats[0] : incomeCats[0] }))}>
                <option value="income">Entrada</option>
                <option value="expense">Saída</option>
              </select>
            </Field>
            <Field label="Data">
              <input type="date" className="input" value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} />
            </Field>
            <Field label="Valor (R$) *">
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </Field>
            <Field label="Categoria">
              <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Descrição"><input className="input" placeholder="Ex.: Pagamento Lavender, Compra de material" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
            </div>
            <Field label="Cliente (opcional)">
              <select className="input" value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
                <option value="">—</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
            <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </CrmModal>
      )}
    </div>
  );
}