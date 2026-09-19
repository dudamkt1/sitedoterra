"use client";

import { useState } from "react";
import { useDemoStore } from "@/lib/demo/store";
import type { DemoSupportMaterialCategory } from "@/lib/demo/types";
import type { MediaFile } from "@/types";
import { MediaUploader } from "@/components/dashboard/MediaUploader";
import { Button, Input, Modal } from "@/components/dashboard/ui";
import { Plus, Trash2, Edit, ExternalLink, Image as ImageIcon, Loader2 } from "lucide-react";

export function SupportMaterials() {
  const { data, update, isDemo } = useDemoStore();
  const [openModal, setOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState<DemoSupportMaterialCategory | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    imageUrl: "",
    linkUrl: "",
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const items = data?.supportMaterials || [];

  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  function handleImageUploaded(media: MediaFile) {
    setFormData((prev) => ({ ...prev, imageUrl: media.public_url }));
    setImageUploading(false);
  }

  function openCreateModal() {
    setEditingItem(null);
    setFormData({ title: "", description: "", imageUrl: "", linkUrl: "" });
    setOpenModal(true);
  }

  function openEditModal(item: DemoSupportMaterialCategory) {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      linkUrl: item.linkUrl,
    });
    setOpenModal(true);
  }

  function closeModal() {
    setOpenModal(false);
    setEditingItem(null);
    setFormData({ title: "", description: "", imageUrl: "", linkUrl: "" });
  }

  async function handleSubmit() {
    if (!formData.title.trim() || !formData.linkUrl.trim()) return;
    setSubmitting(true);
    try {
      if (editingItem) {
        update((draft) => {
          const idx = draft.supportMaterials.findIndex((m) => m.id === editingItem.id);
          if (idx >= 0) {
            draft.supportMaterials[idx] = {
              ...draft.supportMaterials[idx],
              title: formData.title,
              description: formData.description,
              imageUrl: formData.imageUrl,
              linkUrl: formData.linkUrl,
            };
          }
          return draft;
        });
      } else {
        const maxOrder = items.length > 0 ? Math.max(...items.map((m) => m.order)) : 0;
        update((draft) => {
          draft.supportMaterials.push({
            id: `mat_${Date.now()}`,
            title: formData.title,
            description: formData.description,
            imageUrl: formData.imageUrl,
            linkUrl: formData.linkUrl,
            order: maxOrder + 1,
            createdAt: new Date().toISOString(),
          });
          return draft;
        });
      }
      closeModal();
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este material?")) return;
    update((draft) => {
      draft.supportMaterials = draft.supportMaterials.filter((m) => m.id !== id);
      return draft;
    });
  }

  function handleLinkClick(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Materiais de Apoio
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie subcategorias com imagem, título, descrição e link externo.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Subcategoria
        </Button>
      </div>

      {sortedItems.length === 0 ? (
        <div className="card p-12 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum material cadastrado</h3>
          <p className="text-gray-400 mb-6">
            Crie subcategorias com imagem, título, descrição e link para organizar seus materiais de apoio.
          </p>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Criar primeira subcategoria
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className="card group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1"
            >
              {item.imageUrl && (
                <div className="aspect-video relative overflow-hidden bg-gray-100">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 truncate mb-1">{item.title}</h3>
                {item.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{item.description}</p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Ordem: {item.order}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLinkClick(item.linkUrl)}
                      className="gap-1 px-2 py-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Acessar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(item)}
                      className="p-1.5"
                      aria-label="Editar"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={openModal} onClose={closeModal} title={editingItem ? "Editar Subcategoria" : "Nova Subcategoria"}>
        <div className="space-y-4">
          <Input
            label="Título *"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Ex: Catálogo de Produtos"
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
              buttonLabel={formData.imageUrl ? "Alterar imagem" : "+ Adicionar imagem"}
            />
            {formData.imageUrl && (
              <div className="relative mt-2 aspect-video max-h-40 overflow-hidden rounded-lg">
                <img
                  src={formData.imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, imageUrl: "" }))}
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
            value={formData.linkUrl}
            onChange={(e) => setFormData((prev) => ({ ...prev, linkUrl: e.target.value }))}
            placeholder="https://exemplo.com/material"
            required
          />
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
              ) : editingItem ? (
                "Salvar Alterações"
              ) : (
                "Criar Subcategoria"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}