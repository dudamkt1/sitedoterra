"use client";

import { useState } from "react";
import { Plus, Edit, Trash2, Loader2, ExternalLink, Image as ImageIcon } from "lucide-react";
import { Button, Input, Modal } from "@/components/dashboard/ui";
import { MediaUploader } from "@/components/dashboard/MediaUploader";

interface SupportMaterial {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string;
  order: number;
  tenant_id: string | null;
  tenants?: { slug: string; site_name: string | null } | null;
  created_at: string;
  updated_at: string;
}

export default function AdminMateriaisApoioPage() {
  const [materials, setMaterials] = useState<SupportMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<SupportMaterial | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image_url: "",
    link_url: "",
    order: 0,
    tenant_id: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchMaterials() {
    try {
      const res = await fetch("/api/admin/support-materials", { cache: "no-store" });
      const data = await res.json();
      if (data.materials) setMaterials(data.materials);
    } catch (e) {
      console.error("Erro ao buscar materiais:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!formData.title.trim() || !formData.link_url.trim()) return;
    setSubmitting(true);
    try {
      const url = editingMaterial
        ? `/api/admin/support-materials/${editingMaterial.id}`
        : "/api/admin/support-materials";
      const method = editingMaterial ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          order: Number(formData.order),
          tenant_id: formData.tenant_id || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar");
      }

      closeModal();
      fetchMaterials();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este material?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/support-materials/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao excluir");
      fetchMaterials();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setDeletingId(null);
    }
  }

  function openCreateModal() {
    setEditingMaterial(null);
    setFormData({ title: "", description: "", image_url: "", link_url: "", order: 0, tenant_id: "" });
    setOpenModal(true);
  }

  function openEditModal(material: SupportMaterial) {
    setEditingMaterial(material);
    setFormData({
      title: material.title,
      description: material.description || "",
      image_url: material.image_url || "",
      link_url: material.link_url,
      order: material.order,
      tenant_id: material.tenant_id || "",
    });
    setOpenModal(true);
  }

  function closeModal() {
    setOpenModal(false);
    setEditingMaterial(null);
    setFormData({ title: "", description: "", image_url: "", link_url: "", order: 0, tenant_id: "" });
  }

  function handleImageUploaded(media: { public_url: string }) {
    setFormData((prev) => ({ ...prev, image_url: media.public_url }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Materiais de Apoio
          </h1>
          <p className="text-sm text-gray-500">
            Gerencie subcategorias globais de materiais de apoio disponíveis para todos os usuários.
          </p>
        </div>
        <Button onClick={openCreateModal} icon={<Plus className="h-4 w-4 mr-2" />}>
          Novo Material
        </Button>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
        </div>
      ) : materials.length === 0 ? (
        <div className="card p-12 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum material cadastrado</h3>
          <p className="text-gray-400 mb-6">
            Crie materiais de apoio com imagem, título, descrição e link externo.
          </p>
          <Button onClick={openCreateModal} icon={<Plus className="h-4 w-4 mr-2" />}>
            Criar primeiro material
          </Button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-20">Imagem</th>
                <th>Título</th>
                <th>Descrição</th>
                <th className="w-48">Link</th>
                <th className="w-40">Site</th>
                <th className="w-20">Ordem</th>
                <th className="w-36">Ações</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.image_url && (
                      <img src={m.image_url} alt={m.title} className="w-16 h-10 object-cover rounded" />
                    )}
                  </td>
                  <td className="font-medium">{m.title}</td>
                  <td className="text-sm text-gray-500 max-w-xs truncate">{m.description || "—"}</td>
                  <td className="text-sm font-mono text-emerald-600 truncate max-w-xs">
                    <a href={m.link_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-800 flex items-center gap-1">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {m.link_url}
                    </a>
                  </td>
                  <td className="font-mono text-xs text-gray-500">
                    {m.tenants?.site_name || m.tenants?.slug || "Sistema (global)"}
                  </td>
                  <td className="text-sm text-gray-500">{m.order}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(m)}
                        className="p-1.5"
                        aria-label="Editar"
                        disabled={submitting || deletingId === m.id}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(m.id)}
                        className="p-1.5"
                        aria-label="Excluir"
                        disabled={submitting || deletingId === m.id}
                      >
                        {deletingId === m.id ? (
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

      <Modal open={openModal} onClose={closeModal} title={editingMaterial ? "Editar Material" : "Novo Material"}>
        <div className="space-y-4">
          <Input
            label="Título *"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Ex: Catálogo de Produtos 2024"
            required
          />
          <div className="w-full">
            <label className="label">Descrição</label>
            <textarea
              className="input min-h-[80px] resize-y"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição breve do material..."
              rows={3}
            />
          </div>
          <div className="w-full">
            <label className="label">Imagem</label>
            <MediaUploader
              category="general"
              onUploaded={handleImageUploaded}
              buttonLabel={formData.image_url ? "Alterar imagem" : "+ Adicionar imagem"}
            />
            {formData.image_url && (
              <div className="relative mt-2 aspect-video max-h-40 overflow-hidden rounded-lg">
                <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, image_url: "" }))}
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                  aria-label="Remover imagem"
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <Input
            label="Link Externo (abre em nova aba) *"
            type="url"
            value={formData.link_url}
            onChange={(e) => setFormData((prev) => ({ ...prev, link_url: e.target.value }))}
            placeholder="https://exemplo.com/material"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ordem"
              type="number"
              value={formData.order}
              onChange={(e) => setFormData((prev) => ({ ...prev, order: Number(e.target.value) }))}
              min={0}
            />
            <Input
              label="Tenant ID (opcional - deixa vazio para global)"
              value={formData.tenant_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, tenant_id: e.target.value }))}
              placeholder="UUID do tenant"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeModal} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : editingMaterial ? (
                "Salvar Alterações"
              ) : (
                "Criar Material"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}