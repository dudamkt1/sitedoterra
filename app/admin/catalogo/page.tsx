"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  ExternalLink,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button, Input, Modal, Checkbox, SectionTitle } from "@/components/dashboard/ui";
import { MediaUploader } from "@/components/dashboard/MediaUploader";
import {
  centsToBRLInput,
  parseBRLToCents,
  type MainCatalog,
  type MainCatalogProduct,
} from "@/lib/catalog-main";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  category: "",
  unit: "un",
  image_url: "",
  active: true,
};

/**
 * CATÁLOGO (Super Admin) — monta o catálogo público do DOMÍNIO PRINCIPAL.
 * Endereço fixo: https://oleos.topconsultores.com.br/catalogo
 *
 * Salva em `platform_config.main_catalog` (isolado dos `crm_products` dos
 * tenants) via /api/admin/catalogo. Não altera o catálogo `/catalogo/[slug]`
 * dos usuários.
 */
export default function AdminCatalogoPage() {
  const [catalog, setCatalog] = useState<MainCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/catalogo", { cache: "no-store" });
        const j = await res.json();
        if (alive && j.catalog) setCatalog(j.catalog);
      } catch (e) {
        console.error("Erro ao carregar catálogo:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function persist(next: MainCatalog): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/catalogo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const j = await res.json().catch(() => ({}) as { catalog?: MainCatalog; error?: string });
      if (!res.ok) {
        alert(j.error || "Erro ao salvar o catálogo.");
        return false;
      }
      if (j.catalog) setCatalog(j.catalog);
      setDirty(false);
      return true;
    } catch {
      alert("Falha de conexão ao salvar o catálogo.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function patchSettings(patch: Partial<MainCatalog>) {
    setCatalog((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpenModal(true);
  }

  function openEdit(p: MainCatalogProduct) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || "",
      price: centsToBRLInput(p.price_cents),
      category: p.category || "",
      unit: p.unit || "un",
      image_url: p.image_url || "",
      active: p.active,
    });
    setOpenModal(true);
  }

  function closeModal() {
    setOpenModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleProductSubmit() {
    if (!catalog) return;
    const name = form.name.trim();
    if (!name) {
      alert("Informe o nome do produto.");
      return;
    }
    setSubmitting(true);
    try {
      const products = [...catalog.products];
      if (editingId) {
        const idx = products.findIndex((p) => p.id === editingId);
        if (idx >= 0) {
          products[idx] = {
            ...products[idx],
            name,
            description: form.description.trim() || null,
            price_cents: parseBRLToCents(form.price),
            category: form.category.trim() || null,
            image_url: form.image_url.trim() || null,
            unit: form.unit.trim() || "un",
            active: form.active,
          };
        }
      } else {
        products.push({
          id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          name,
          description: form.description.trim() || null,
          price_cents: parseBRLToCents(form.price),
          category: form.category.trim() || null,
          image_url: form.image_url.trim() || null,
          unit: form.unit.trim() || "un",
          order: products.length,
          active: form.active,
        });
      }
      const ok = await persist({ ...catalog, products });
      if (ok) closeModal();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!catalog) return;
    if (!confirm("Excluir este produto do catálogo?")) return;
    setDeletingId(id);
    try {
      const products = catalog.products.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i }));
      await persist({ ...catalog, products });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(p: MainCatalogProduct) {
    if (!catalog) return;
    const products = catalog.products.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x));
    await persist({ ...catalog, products });
  }

  async function move(index: number, dir: -1 | 1) {
    if (!catalog) return;
    const products = [...catalog.products];
    const target = index + dir;
    if (target < 0 || target >= products.length) return;
    [products[index], products[target]] = [products[target], products[index]];
    const reordered = products.map((p, i) => ({ ...p, order: i }));
    await persist({ ...catalog, products: reordered });
  }

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
      </div>
    );
  }

  if (!catalog) {
    return <div className="card p-8 text-center text-sm text-gray-500">Não foi possível carregar o catálogo.</div>;
  }

  const activeCount = catalog.products.filter((p) => p.active).length;

  return (
    <div>
      <SectionTitle
        sub="Monte o catálogo de amostra que aparece no domínio principal, em https://oleos.topconsultores.com.br/catalogo. Produtos ficam isolados dos catálogos dos usuários."
      >
        Catálogo
      </SectionTitle>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <a href="/catalogo" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" icon={<ExternalLink className="h-4 w-4 mr-2" />}>
            Ver catálogo público
          </Button>
        </a>
        <Button onClick={openCreate} icon={<Plus className="h-4 w-4 mr-2" />}>
          Novo produto
        </Button>
        <Button
          onClick={() => persist(catalog)}
          disabled={!dirty || saving}
          variant="green"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {dirty ? "Salvar publicação" : "Salvo"}
        </Button>
      </div>

      {/* ── Publicação ─────────────────────────────────────── */}
      <div className="card mb-6 p-5">
        <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>
          Publicação
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Título"
            value={catalog.title}
            onChange={(e) => patchSettings({ title: e.target.value })}
            placeholder="Catálogo"
          />
          <Input
            label="Subtítulo"
            value={catalog.subtitle}
            onChange={(e) => patchSettings({ subtitle: e.target.value })}
            placeholder="Conheça os produtos e kits disponíveis."
          />
          <Input
            label="WhatsApp (com DDD — ex.: 11999998888)"
            value={catalog.whatsapp}
            onChange={(e) => patchSettings({ whatsapp: e.target.value })}
            placeholder="11999998888"
          />
          <div className="flex items-end pb-1">
            <Checkbox
              label="Catálogo publicado (desmarcado, a página /catalogo retorna 404)"
              checked={catalog.enabled}
              onChange={(e) => patchSettings({ enabled: e.target.checked })}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          O logotipo e o nome exibidos são os mesmos do site oficial (editor da home). Se o WhatsApp estiver vazio,
          cai no WhatsApp cadastrado nas informações do site.
        </p>
      </div>

      {/* ── Produtos ───────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Produtos
            </h2>
            <p className="text-xs text-gray-400">
              {catalog.products.length} cadastrado{catalog.products.length === 1 ? "" : "s"} · {activeCount} publicado
              {activeCount === 1 ? "" : "s"}
            </p>
          </div>
          <Button size="sm" onClick={openCreate} icon={<Plus className="h-4 w-4 mr-1" />}>
            Novo
          </Button>
        </div>

        {catalog.products.length === 0 ? (
          <div className="p-10 text-center">
            <ImageIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum produto ainda</h3>
            <p className="text-gray-400 mb-6">
              Adicione produtos com imagem, preço e categoria para montar a amostra do catálogo público.
            </p>
            <Button onClick={openCreate} icon={<Plus className="h-4 w-4 mr-2" />}>
              Criar primeiro produto
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-16">Ordem</th>
                  <th className="w-20">Imagem</th>
                  <th>Produto</th>
                  <th className="w-40">Categoria</th>
                  <th className="w-32">Preço</th>
                  <th className="w-24">Unidade</th>
                  <th className="w-24">Status</th>
                  <th className="w-44">Ações</th>
                </tr>
              </thead>
              <tbody>
                {catalog.products.map((p, i) => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={saving || i === 0}
                          aria-label="Subir"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={saving || i === catalog.products.length - 1}
                          aria-label="Descer"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td>
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt={p.name} className="w-16 h-10 object-cover rounded" />
                      ) : (
                        <span className="text-lg text-gray-300">📦</span>
                      )}
                    </td>
                    <td>
                      <p className="font-medium text-gray-800">{p.name}</p>
                      {p.description && (
                        <p className="text-xs text-gray-400 max-w-sm truncate">{p.description}</p>
                      )}
                    </td>
                    <td className="text-sm text-gray-500">{p.category || "—"}</td>
                    <td className="text-sm font-semibold text-gray-700">
                      {(p.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="text-sm text-gray-500">{p.unit || "un"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        disabled={saving}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          p.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.active ? "Publicado" : "Oculto"}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(p)}
                          className="p-1.5"
                          aria-label="Editar"
                          disabled={saving || submitting}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5"
                          aria-label="Excluir"
                          disabled={saving || deletingId === p.id}
                        >
                          {deletingId === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={openModal}
        onClose={closeModal}
        title={editingId ? "Editar produto" : "Novo produto"}
      >
        <div className="space-y-4">
          <Input
            label="Nome *"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Kit Óleos Essenciais"
            required
          />
          <div className="w-full">
            <label className="label">Descrição</label>
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição breve do produto..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Preço (R$) *"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              placeholder="39,90"
              inputMode="decimal"
            />
            <Input
              label="Unidade"
              value={form.unit}
              onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
              placeholder="un"
            />
          </div>
          <Input
            label="Categoria"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="Ex: Kits, Óleos, Difusores"
          />
          <div className="w-full">
            <label className="label">Imagem</label>
            <MediaUploader
              scope="system"
              category="general"
              onUploaded={(media) => setForm((prev) => ({ ...prev, image_url: media.public_url }))}
              buttonLabel={form.image_url ? "Alterar imagem" : "+ Adicionar imagem"}
            />
            {form.image_url && (
              <div className="relative mt-2 aspect-video max-h-40 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, image_url: "" }))}
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                  aria-label="Remover imagem"
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <Checkbox
            label="Publicar no catálogo"
            checked={form.active}
            onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeModal} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleProductSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : editingId ? (
                "Salvar Alterações"
              ) : (
                "Criar Produto"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
