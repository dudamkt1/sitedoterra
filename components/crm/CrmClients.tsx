"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CrmModal, EmptyState, LoadingState, ErrorState, Toast, Field, apiPost, confirmDialog } from "@/components/crm/crm-ui";
import { formatBRL } from "@/lib/utils";
import { CLIENT_CATEGORY_COLORS } from "@/lib/crm-shared";
import type { CrmClient } from "@/types";

export default function CrmClients({ initialSettings }: { initialSettings?: any }) {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [onlyVip, setOnlyVip] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [noContact, setNoContact] = useState(false);
  const [minSpent, setMinSpent] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const categories = Array.isArray(initialSettings?.categories) && initialSettings.categories.length
    ? initialSettings.categories
    : ["Lead", "Novo cliente", "Cliente ativo", "Cliente recorrente", "Cliente VIP", "Cliente inativo", "Cliente perdido"];

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage), sort });
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (city) params.set("city", city);
      if (onlyVip) params.set("onlyVip", "1");
      if (inactive) params.set("inactive", "1");
      if (noContact) params.set("noContact", "1");
      if (minSpent) params.set("minSpent", String(Math.round(parseFloat(minSpent) * 100)));
      const res = await fetch(`/api/crm/clients?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar clientes.");
      setClients(json.clients);
      setTotal(json.total);
      setTotalPages(json.totalPages);
      setCities(json.cities || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Lê filtros vindos do dashboard (?onlyVip=1 / ?noContact=1)
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("onlyVip") === "1") setOnlyVip(true);
    if (sp.get("noContact") === "1") setNoContact(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, city, onlyVip, inactive, noContact, minSpent, sort, page, perPage]);

  async function createClient() {
    setSaving(true);
    try {
      await apiPost("/api/crm/clients", form);
      setToast({ ok: true, text: "Cliente cadastrado com sucesso!" });
      setShowCreate(false);
      setForm({});
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao cadastrar." });
    } finally {
      setSaving(false);
    }
  }

  async function removeClient(c: CrmClient) {
    if (!confirmDialog(`Excluir definitivamente o cliente "${c.name}"? Esta ação não pode ser desfeita (LGPD).`)) return;
    const res = await fetch(`/api/crm/clients/${c.id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok) {
      setToast({ ok: true, text: "Cliente excluído." });
      load();
    } else {
      setToast({ ok: false, text: json.error || "Erro ao excluir." });
    }
  }

  const input = (key: string, label: string, type = "text") => (
    <Field label={label}>
      <input
        type={type}
        className="input"
        value={form[key] || ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </Field>
  );

  return (
    <div>
      <Toast msg={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">{total} clientes cadastrados</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({}); setShowCreate(true); }}>+ Novo cliente</button>
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <label className="label">Buscar</label>
            <input className="input" placeholder="Nome, telefone, WhatsApp, e-mail ou cidade..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="">Todas</option>
              {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Cidade</label>
            <select className="input" value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }}>
              <option value="">Todas</option>
              {cities.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Ordenar por</label>
            <select className="input" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <option value="name">Nome</option>
              <option value="recent">Mais recentes</option>
              <option value="revenue">Maior faturamento</option>
              <option value="purchases">Mais compras</option>
              <option value="last_purchase">Última compra</option>
            </select>
          </div>
          <div>
            <label className="label">Gasto mínimo (R$)</label>
            <input type="number" className="input" placeholder="0" value={minSpent} onChange={(e) => { setMinSpent(e.target.value); setPage(1); }} />
          </div>
          <div className="flex items-end gap-2 pb-1 flex-wrap">
            <button className={`badge !px-3 !py-1.5 cursor-pointer ${onlyVip ? "bg-[#c4963a] text-white" : "bg-gray-100 text-gray-600"}`} onClick={() => { setOnlyVip((v) => !v); setPage(1); }}>⭐ VIP</button>
            <button className={`badge !px-3 !py-1.5 cursor-pointer ${inactive ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-600"}`} onClick={() => { setInactive((v) => !v); setPage(1); }}>Inativos</button>
            <button className={`badge !px-3 !py-1.5 cursor-pointer ${noContact ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`} onClick={() => { setNoContact((v) => !v); setPage(1); }}>Sem contato 30d</button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Carregando clientes..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : clients.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="👥"
            title="Você ainda não possui clientes cadastrados."
            sub="Cadastre seu primeiro cliente para começar a organizar seu negócio."
            action={<button className="btn btn-primary" onClick={() => { setForm({}); setShowCreate(true); }}>+ Cadastrar primeiro cliente</button>}
          />
        </div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Categoria</th>
                  <th>Contato</th>
                  <th>Cidade</th>
                  <th>Compras</th>
                  <th>Total gasto</th>
                  <th>Última compra</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/painel/crm/clientes/${c.id}`} className="font-medium text-gray-800 hover:text-[#1d5c3a]">
                        {c.name} {c.is_vip && "⭐"}
                      </Link>
                      <p className="text-xs text-gray-400">{c.email || ""}</p>
                    </td>
                    <td><span className={`badge ${CLIENT_CATEGORY_COLORS[c.category] || "badge-gray"}`}>{c.category}</span></td>
                    <td className="text-sm">{c.whatsapp || c.phone || "—"}</td>
                    <td className="text-sm text-gray-500">{c.city || "—"}</td>
                    <td>{c.purchase_count || 0}</td>
                    <td className="font-medium">{formatBRL(c.total_spent_cents || 0)}</td>
                    <td className="text-sm text-gray-500">{c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString("pt-BR") : "—"}</td>
                    <td>
                      <button className="text-red-500 text-sm px-1" title="Excluir cliente" onClick={() => removeClient(c)}>🗑</button>
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

      {showCreate && (
        <CrmModal
          title="+ Novo cliente"
          onClose={() => setShowCreate(false)}
          wide
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" disabled={saving || !form.name} onClick={createClient}>
                {saving ? "Salvando..." : "Salvar cliente"}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">{input("name", "Nome completo *")}</div>
            <Field label="Categoria">
              <select className="input" value={form.category || "Novo cliente"} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Data de nascimento">
              <input type="date" className="input" value={form.birth_date || ""} onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))} />
            </Field>
            <div className="md:col-span-2">{input("cpf", "CPF (opcional)")}</div>
            {input("email", "E-mail", "email")}
            {input("phone", "Telefone")}
            {input("whatsapp", "WhatsApp")}
            {input("city", "Cidade")}
            {input("state", "Estado")}
            <Field label="Data do primeiro contato">
              <input type="date" className="input" value={form.first_contact_at || ""} onChange={(e) => setForm((f) => ({ ...f, first_contact_at: e.target.value }))} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Observações">
                <textarea className="input min-h-20" value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </Field>
            </div>
          </div>
        </CrmModal>
      )}
    </div>
  );
}