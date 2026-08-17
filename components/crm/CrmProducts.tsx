"use client";

import { useEffect, useState } from "react";
import { CrmModal, EmptyState, LoadingState, ErrorState, Toast, Field, apiPost, apiPut, apiDelete, confirmDialog } from "@/components/crm/crm-ui";
import { formatBRL } from "@/lib/utils";
import type { CrmProduct } from "@/types";

export default function CrmProducts() {
  const [products, setProducts] = useState<CrmProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CrmProduct | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/products?all=1");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar produtos.");
      setProducts(json.products);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar produtos.");
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", price: "", category: "", description: "", image_url: "" });
    setShowForm(true);
  }
  function openEdit(p: CrmProduct) {
    setEditing(p);
    setForm({ name: p.name, price: (p.price_cents / 100).toFixed(2).replace(".", ","), category: p.category || "", description: p.description || "", image_url: p.image_url || "" });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      const priceCents = Math.round(parseFloat(form.price.replace(",", ".")) * 100 || 0);
      if (editing) {
        await apiPut(`/api/crm/products/${editing.id}`, { name: form.name, price_cents: priceCents, category: form.category, description: form.description, image_url: form.image_url });
        setToast({ ok: true, text: "Produto atualizado!" });
      } else {
        await apiPost("/api/crm/products", { name: form.name, price_cents: priceCents, category: form.category, description: form.description, image_url: form.image_url });
        setToast({ ok: true, text: "Produto cadastrado!" });
      }
      setShowForm(false);
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: CrmProduct) {
    if (!confirmDialog(`Excluir o produto "${p.name}"? As vendas antigas preservam o nome.`)) return;
    try {
      await apiDelete(`/api/crm/products/${p.id}`);
      setToast({ ok: true, text: "Produto excluído." });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao excluir." });
    }
  }

  async function toggleActive(p: CrmProduct) {
    await apiPut(`/api/crm/products/${p.id}`, { active: !p.active });
    load();
  }

  return (
    <div>
      <Toast msg={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Produtos</h1>
          <p className="text-sm text-gray-500 mt-1">Catálogo usado nas vendas. Só você visualiza e utiliza.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Novo produto</button>
      </div>

      {loading ? (
        <LoadingState label="Carregando produtos..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : products.length === 0 ? (
        <div className="card">
          <EmptyState icon="🧴" title="Você ainda não cadastrou produtos." sub="Cadastre os óleos essenciais e produtos que você revende para registrar vendas com itens." action={<button className="btn btn-primary" onClick={openCreate}>+ Cadastrar primeiro produto</button>} />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Vendidos</th><th>Faturamento</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" referrerPolicy="no-referrer" />}
                      <div>
                        <p className="font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.description || ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-gray-500">{p.category || "—"}</td>
                  <td className="font-medium">{formatBRL(p.price_cents)}</td>
                  <td>{p.units_sold || 0}</td>
                  <td>{formatBRL(p.sold_cents || 0)}</td>
                  <td>
                    <button className={`badge cursor-pointer ${p.active ? "badge-green" : "badge-gray"}`} onClick={() => toggleActive(p)}>
                      {p.active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="whitespace-nowrap">
                    <button className="btn btn-outline !py-1 !px-2 !text-xs mr-1" onClick={() => openEdit(p)}>Editar</button>
                    <button className="btn btn-outline !py-1 !px-2 !text-xs text-red-500" onClick={() => remove(p)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <CrmModal title={editing ? "✏️ Editar produto" : "+ Novo produto"} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <Field label="Nome do produto *"><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Preço (R$)"><input className="input" inputMode="decimal" placeholder="0,00" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} /></Field>
              <Field label="Categoria"><input className="input" placeholder="Ex.: Óleos, Líneas, BEM" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></Field>
            </div>
            <Field label="URL da imagem (opcional)"><input className="input" placeholder="https://..." value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} /></Field>
            <Field label="Descrição"><textarea className="input min-h-16" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving || !form.name} onClick={save}>{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </CrmModal>
      )}
    </div>
  );
}