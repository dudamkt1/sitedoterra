"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Loader2, Image as ImageIcon, Download, Eye, EyeOff } from "lucide-react";
import { Button, Input, Modal, Checkbox } from "@/components/dashboard/ui";
import { MediaUploader } from "@/components/dashboard/MediaUploader";
import {
  AFFILIATE_MATERIAL_FORMAT_LABELS,
  type AffiliateMaterial,
  type AffiliateMaterialFormat,
  type AffiliateMaterialKind,
  type MediaFile,
} from "@/types";

interface FormState {
  title: string;
  description: string;
  kind: AffiliateMaterialKind;
  format: AffiliateMaterialFormat;
  file_url: string;
  thumbnail_url: string;
  file_size_bytes: string;
  width: string;
  height: string;
  active: boolean;
  sort_order: number;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  kind: "imagem",
  format: "feed_1x1",
  file_url: "",
  thumbnail_url: "",
  file_size_bytes: "",
  width: "",
  height: "",
  active: true,
  sort_order: 0,
};

export function AffiliateMaterialsManager() {
  const [materials, setMaterials] = useState<AffiliateMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingMigration, setMissingMigration] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<AffiliateMaterial | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/affiliate/materials", { cache: "no-store" });
      const data = await res.json();
      if (data.missingMigration) setMissingMigration(true);
      if (Array.isArray(data.materials)) setMaterials(data.materials);
    } catch (e) {
      console.error("Erro ao buscar materiais:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpenModal(true);
  }

  function openEdit(m: AffiliateMaterial) {
    setEditing(m);
    setForm({
      title: m.title,
      description: m.description || "",
      kind: m.kind,
      format: m.format,
      file_url: m.file_url,
      thumbnail_url: m.thumbnail_url || "",
      file_size_bytes: m.file_size_bytes ? String(m.file_size_bytes) : "",
      width: m.width ? String(m.width) : "",
      height: m.height ? String(m.height) : "",
      active: m.active,
      sort_order: m.sort_order,
    });
    setOpenModal(true);
  }

  function handleUploaded(media: MediaFile) {
    setForm((prev) => ({
      ...prev,
      file_url: media.public_url,
      // Imagem usa o próprio arquivo como capa; vídeo usa o poster (onPoster).
      thumbnail_url: prev.kind === "imagem" ? media.public_url : prev.thumbnail_url,
      file_size_bytes: media.file_size ? String(media.file_size) : prev.file_size_bytes,
      width: media.width ? String(media.width) : prev.width,
      height: media.height ? String(media.height) : prev.height,
    }));
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.file_url.trim()) return;
    setSubmitting(true);
    try {
      const url = editing
        ? `/api/admin/affiliate/materials/${editing.id}`
        : "/api/admin/affiliate/materials";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          kind: form.kind,
          format: form.format,
          file_url: form.file_url.trim(),
          thumbnail_url: form.thumbnail_url.trim() || null,
          file_size_bytes: form.file_size_bytes === "" ? null : Number(form.file_size_bytes),
          width: form.width === "" ? null : Number(form.width),
          height: form.height === "" ? null : Number(form.height),
          active: form.active,
          sort_order: Number(form.sort_order) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao salvar");
      }
      setOpenModal(false);
      setEditing(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(m: AffiliateMaterial) {
    try {
      const res = await fetch(`/api/admin/affiliate/materials/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !m.active }),
      });
      if (!res.ok) throw new Error("Erro ao alternar");
      load();
    } catch {
      alert("Erro ao alternar visibilidade");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este material? Os afiliados deixarão de vê-lo.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/affiliate/materials/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
      load();
    } catch {
      alert("Erro ao excluir");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
      </div>
    );
  }

  if (missingMigration) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-gray-500">
          As tabelas de materiais ainda não existem no banco. Aplique a migration{" "}
          <code>0054_affiliate_materials.sql</code>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-gray-500">
          Arquivos que os afiliados baixam em <strong>/painel/afiliados</strong>. Padrão: imagens
          Feed 1080×1080 · Stories 1080×1920 · vídeos 1:1 e 9:16.
        </p>
        <Button onClick={openCreate} icon={<Plus className="h-4 w-4 mr-2" />}>
          Novo Material
        </Button>
      </div>

      {materials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <ImageIcon className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-600">Nenhum material para afiliados</p>
          <p className="text-sm text-gray-400 mt-1">Suba o primeiro criativo no padrão feed/stories.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {materials.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border bg-white overflow-hidden ${m.active ? "border-gray-200" : "border-gray-200 opacity-60"}`}
            >
              <div className="relative bg-gray-100 flex items-center justify-center overflow-hidden"
                style={{ aspectRatio: m.format === "story_9x16" ? "9 / 16" : "1 / 1", maxHeight: 220 }}>
                {m.kind === "video" ? (
                  m.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbnail_url} alt={m.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-4xl">🎬</span>
                  )
                ) : m.file_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.file_url} alt={m.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-4xl">🖼️</span>
                )}
                <span className="absolute top-2 left-2 badge badge-gold !text-[10px]">
                  {m.kind === "video" ? "🎬 Vídeo" : "🖼️ Imagem"}
                </span>
                <span className="absolute top-2 right-2 badge badge-gray !text-[10px]">
                  {m.format === "story_9x16" ? "Stories 9:16" : "Feed 1:1"}
                </span>
                {!m.active && (
                  <span className="absolute bottom-2 left-2 badge badge-gray !text-[10px]">Oculto</span>
                )}
              </div>
              <div className="p-3">
                <p className="font-semibold text-sm text-gray-800 truncate">{m.title}</p>
                {m.description && <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{m.description}</p>}
                <p className="text-[11px] text-gray-400 mt-1">
                  {AFFILIATE_MATERIAL_FORMAT_LABELS[m.format]}
                  {m.width && m.height ? ` · ${m.width}×${m.height}` : ""} · {formatBytes(m.file_size_bytes)}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline !py-1 !px-2 !text-xs"
                    title="Abrir arquivo"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    className="btn btn-outline !py-1 !px-2 !text-xs"
                    title={m.active ? "Ocultar dos afiliados" : "Mostrar aos afiliados"}
                    onClick={() => toggleActive(m)}
                  >
                    {m.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline !py-1 !px-2 !text-xs"
                    title="Editar"
                    onClick={() => openEdit(m)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline !py-1 !px-2 !text-xs hover:!border-red-300 hover:!text-red-600"
                    title="Excluir"
                    disabled={deletingId === m.id}
                    onClick={() => handleDelete(m.id)}
                  >
                    {deletingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={openModal} onClose={() => setOpenModal(false)} title={editing ? "Editar Material" : "Novo Material"}>
        <div className="space-y-4">
          <Input
            label="Título *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Ex: Convite Feed — TopConsultores"
          />
          <div className="w-full">
            <label className="label">Descrição (como usar)</label>
            <textarea
              className="input min-h-[70px] resize-y"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Poste no feed com seu link de afiliado na bio."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo *</label>
              <div className="flex gap-2">
                {(["imagem", "video"] as AffiliateMaterialKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`btn flex-1 !py-2 !text-sm ${form.kind === k ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setForm((f) => ({ ...f, kind: k, file_url: "", thumbnail_url: "" }))}
                  >
                    {k === "imagem" ? "🖼️ Imagem" : "🎬 Vídeo"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Formato *</label>
              <div className="flex gap-2">
                {(["feed_1x1", "story_9x16"] as AffiliateMaterialFormat[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`btn flex-1 !py-2 !text-sm ${form.format === f ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setForm((f2) => ({ ...f2, format: f }))}
                  >
                    {f === "feed_1x1" ? "Feed 1:1" : "Stories 9:16"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 -mt-2">
            Padrão: imagens Feed 1080×1080 · Stories 1080×1920 · vídeos 1:1 e 9:16.
          </p>

          <div className="w-full">
            <label className="label">Arquivo * ({form.kind === "video" ? "MP4/WebM" : "JPG/PNG/WebP"})</label>
            <MediaUploader
              scope="system"
              category={form.kind === "video" ? "video" : "general"}
              acceptVideo={form.kind === "video"}
              onUploaded={handleUploaded}
              onPoster={(url) => setForm((f) => ({ ...f, thumbnail_url: url }))}
              buttonLabel={form.file_url ? "Trocar arquivo" : "+ Enviar arquivo"}
            />
            {form.file_url && (
              <p className="text-xs text-green-700 mt-1 truncate">✓ {form.file_url}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Ordem"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
              min={0}
            />
            <Input
              label="Largura (px)"
              type="number"
              value={form.width}
              onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))}
              placeholder="1080"
            />
            <Input
              label="Altura (px)"
              type="number"
              value={form.height}
              onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
              placeholder="1080"
            />
          </div>

          <Checkbox
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            label="Visível para os afiliados"
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenModal(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.title.trim() || !form.file_url.trim()}>
              {submitting ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function formatBytes(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
