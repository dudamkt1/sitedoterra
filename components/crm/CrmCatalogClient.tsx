"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CrmModal, EmptyState, LoadingState, ErrorState, Toast, Field, apiPost, apiPut, apiDelete, confirmDialog } from "@/components/crm/crm-ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatBRL } from "@/lib/utils";
import type { CrmProduct } from "@/types";

const UNITS = ["un", "cx", "kit", "pct", "kg", "g", "ml", "L", "fr", "mes", "serv"];
const STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
];

const DEFAULT_FORM = {
  name: "",
  description: "",
  price_cents: 0,
  category: "",
  image_url: "",
  sku: "",
  unit: "un",
  notes: "",
  active: true,
  show_publicly: true,
};

type FormState = typeof DEFAULT_FORM;

export default function CrmCatalogClient({ tenantSlug }: { tenantSlug: string | null }) {
  const [products, setProducts] = useState<CrmProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CrmProduct | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showShare, setShowShare] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/products?all=1", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar catálogo.");
      setProducts(json.products || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar catálogo.");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(p.category);
    return Array.from(set).sort();
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (q) {
        const haystack = [p.name, p.category || "", p.sku || ""].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [products, statusFilter, categoryFilter, search]);

  const counts = useMemo(() => {
    const active = products.filter((p) => p.active).length;
    const inactive = products.length - active;
    return { all: products.length, active, inactive };
  }, [products]);

  function openCreate() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  }
  function openEdit(p: CrmProduct) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price_cents: p.price_cents,
      category: p.category || "",
      image_url: p.image_url || "",
      sku: p.sku || "",
      unit: p.unit || "un",
      notes: p.notes || "",
      active: p.active,
      show_publicly: p.show_publicly !== false,
    });
    setShowForm(true);
  }
  function duplicate(p: CrmProduct) {
    setEditing(null);
    setForm({
      name: `${p.name} (cópia)`,
      description: p.description || "",
      price_cents: p.price_cents,
      category: p.category || "",
      image_url: p.image_url || "",
      sku: p.sku || "",
      unit: p.unit || "un",
      notes: p.notes || "",
      active: p.active,
      show_publicly: p.show_publicly !== false,
    });
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  async function save() {
    if (!form.name.trim()) {
      setToast({ ok: false, text: "Informe o nome do produto." });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price_cents: form.price_cents,
        category: form.category.trim() || null,
        image_url: form.image_url.trim() || null,
        sku: form.sku.trim() || null,
        unit: form.unit || "un",
        notes: form.notes.trim() || null,
        active: form.active,
        show_publicly: form.show_publicly,
      };
      if (editing) {
        await apiPut(`/api/crm/products/${editing.id}`, body);
        setToast({ ok: true, text: "Produto atualizado!" });
      } else {
        await apiPost("/api/crm/products", body);
        setToast({ ok: true, text: "Produto cadastrado!" });
      }
      closeForm();
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: CrmProduct) {
    if (!confirmDialog(`Excluir o produto "${p.name}"? Vendas antigas preservam o nome e o valor original (o histórico é mantido).`)) return;
    try {
      await apiDelete(`/api/crm/products/${p.id}`);
      setToast({ ok: true, text: "Produto excluído do catálogo." });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao excluir." });
    }
  }

  async function toggleActive(p: CrmProduct) {
    try {
      await apiPut(`/api/crm/products/${p.id}`, { active: !p.active });
      setToast({ ok: true, text: p.active ? "Produto desativado." : "Produto ativado." });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao atualizar." });
    }
  }

  const publicUrl = tenantSlug ? `${typeof window !== "undefined" ? window.location.origin : ""}/catalogo/${tenantSlug}` : "";

  return (
    <div>
      <Toast msg={toast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Catálogo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Seus produtos para usar nas vendas e compartilhar com clientes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tenantSlug && (
            <button type="button" className="btn btn-outline !text-sm" onClick={() => setShowShare(true)}>
              📤 Compartilhar catálogo
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Adicionar produto
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-[14px] border border-[#e2e8e0] bg-white p-4 sm:p-5 mb-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <label className="block text-[11px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Buscar produto</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa5a0]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, categoria ou SKU…"
                className="w-full rounded-[10px] border border-[#dde2dc] bg-white pl-9 pr-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
              />
            </div>
          </div>
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              className="w-full rounded-[10px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label} ({s.value === "all" ? counts.all : counts[s.value as "active" | "inactive"]})</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold tracking-wide uppercase text-[#6b7a72] mb-1.5">Categoria</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-[10px] border border-[#dde2dc] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1d5c3a]/15 focus:border-[#1d5c3a]"
            >
              <option value="">Todas</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Carregando catálogo..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : products.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="📦"
            title="Seu catálogo está vazio"
            sub="Cadastre seus produtos para usar nas vendas e compartilhar com clientes."
            action={
              <button className="btn btn-primary" onClick={openCreate}>
                + Criar primeiro produto
              </button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🔎"
            title="Nenhum produto com esses filtros"
            sub="Ajuste a busca ou os filtros para ver outros produtos."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visible.map((p) => (
            <article
              key={p.id}
              className="group rounded-[16px] border border-[#e2e8e0] bg-white overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition flex flex-col"
            >
              <div className="relative aspect-[4/3] bg-gradient-to-br from-[#eaf6ec] to-[#f5f7f4] overflow-hidden">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-5xl text-[#1d5c3a]/30 select-none">📦</div>
                )}
                {p.category && (
                  <span className="absolute top-2 left-2 inline-flex items-center rounded-full bg-white/95 border border-slate-200 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 leading-none shadow-sm">
                    {p.category}
                  </span>
                )}
                <span
                  className={`absolute top-2 right-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold border leading-none ${
                    p.active ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  {p.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-[15px] font-bold text-[#0d3320] leading-snug line-clamp-2" title={p.name}>
                  {p.name}
                </h3>
                {p.sku && <p className="text-[11px] text-[#6b7a72] mt-0.5">SKU: {p.sku}</p>}
                {p.description && (
                  <p className="text-[12.5px] text-[#4a5a52] leading-5 mt-1.5 line-clamp-2">{p.description}</p>
                )}
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <p className="text-[18px] font-extrabold text-[#0d3320] tracking-tight">{formatBRL(p.price_cents)}</p>
                  <span className="text-[11px] text-[#6b7a72]">/ {p.unit || "un"}</span>
                </div>
                {p.units_sold !== undefined && p.units_sold > 0 && (
                  <p className="text-[10.5px] text-[#6b7a72] mt-1">
                    {p.units_sold} vendido{p.units_sold === 1 ? "" : "s"} · {formatBRL(p.sold_cents || 0)}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-[#1d5c3a]/30 hover:text-[#1d5c3a] transition"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicate(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                    title="Duplicar"
                  >
                    ⧉ Duplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] font-semibold transition ${
                      p.active
                        ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    }`}
                    title={p.active ? "Desativar" : "Ativar"}
                  >
                    {p.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-white px-2 py-1 text-[11.5px] font-semibold text-red-600 hover:bg-red-50 transition"
                    title="Excluir"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal de cadastro/edição */}
      {showForm && (
        <CrmModal
          title={editing ? "✏️ Editar produto" : "📦 Adicionar produto"}
          onClose={closeForm}
          wide
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={closeForm}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
                {saving ? "Salvando..." : (editing ? "Salvar alterações" : "Cadastrar produto")}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nome do produto *">
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Óleo Essencial Lavanda 15ml"
                maxLength={200}
              />
            </Field>
            <Field label="Código / SKU (opcional)">
              <input
                className="input"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                placeholder="Ex.: LAV-15"
                maxLength={80}
              />
            </Field>
            <Field label="Categoria">
              <input
                className="input"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Ex.: Óleos essenciais, Kits, Cuidados"
                list="catalog-categories"
                maxLength={80}
              />
              <datalist id="catalog-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Unidade">
              <select
                className="input"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              >
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Preço (R$)">
              <MoneyInput
                className="input"
                value={form.price_cents}
                onChange={(cents) => setForm((f) => ({ ...f, price_cents: cents }))}
                placeholder="R$ 0,00"
                aria-label="Preço do produto"
              />
            </Field>
            <Field label="URL da imagem (opcional)">
              <input
                className="input"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                placeholder="https://..."
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-5">
                💡 Precisa hospedar uma imagem? Use o{" "}
                <a href="https://postimages.org/" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800">
                  Postimages
                </a>{" "}
                gratuitamente. Copie o <b>link direto da imagem</b>.
              </p>
            </Field>
            <div className="md:col-span-2">
              <Field label="Descrição">
                <textarea
                  className="input min-h-20"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  maxLength={2000}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Observações internas (opcional)">
                <textarea
                  className="input min-h-16"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Anotações que não aparecem no catálogo público (custo, fornecedor, código de barras, etc.)"
                  maxLength={2000}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-1">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Ativo (disponível para uso)
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-1">
              <input
                type="checkbox"
                checked={form.show_publicly}
                onChange={(e) => setForm((f) => ({ ...f, show_publicly: e.target.checked }))}
              />
              Exibir no catálogo público
            </label>
          </div>
        </CrmModal>
      )}

      {/* Modal de compartilhamento */}
      {showShare && tenantSlug && publicUrl && (
        <ShareCatalogModal url={publicUrl} onClose={() => setShowShare(false)} productCount={products.filter((p) => p.active && p.show_publicly).length} />
      )}
    </div>
  );
}

function ShareCatalogModal({ url, onClose, productCount }: { url: string; onClose: () => void; productCount: number }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (typeof navigator === "undefined") return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  function shareWhatsapp() {
    const msg = encodeURIComponent(`Olá! Conheça nosso catálogo de produtos: ${url}`);
    if (typeof window !== "undefined") window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
  }

  function shareNative() {
    if (typeof navigator === "undefined" || !navigator.share) {
      copyLink();
      return;
    }
    navigator.share({ title: "Catálogo de produtos", url, text: "Conheça nosso catálogo" }).catch(() => {});
  }

  return (
    <CrmModal title="📤 Compartilhar catálogo" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-[#4a5a52]">
          Compartilhe o link abaixo com seus clientes. Apenas produtos <b>ativos</b> e marcados como <b>públicos</b> aparecem ({productCount} disponíve{productCount === 1 ? "l" : "is"}).
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={url}
            onClick={(e) => e.currentTarget.select()}
            className="input flex-1 font-mono text-[12.5px]"
          />
          <button type="button" className="btn btn-outline !whitespace-nowrap" onClick={copyLink}>
            {copied ? "✓ Copiado" : "📋 Copiar"}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Conheça nosso catálogo: ${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); shareWhatsapp(); }}
            className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#25D366] hover:bg-[#1ebe5b] text-white text-[14px] font-semibold px-4 py-3 transition"
          >
            💬 Compartilhar no WhatsApp
          </a>
          <button
            type="button"
            onClick={shareNative}
            className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-slate-200 bg-white hover:bg-slate-50 text-[#2d3a4a] text-[14px] font-semibold px-4 py-3 transition"
          >
            📲 Compartilhar
          </button>
        </div>
        <p className="text-[11.5px] text-[#6b7a72] pt-1">
          O link abre uma página pública do catálogo, sem necessidade de login.
        </p>
        <div className="flex justify-end pt-1">
          <Link href={url} target="_blank" className="text-[12.5px] font-semibold text-[#1d5c3a] hover:underline">
            👁️ Visualizar catálogo público
          </Link>
        </div>
      </div>
    </CrmModal>
  );
}
