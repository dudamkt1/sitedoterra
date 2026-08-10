"use client";

import { useState } from "react";
import type { SiteSection, SectionType, SectionPermissions } from "@/types";
import { SECTION_TYPES, SECTION_TYPE_LABELS, SECTION_TYPE_ICONS, normalizeSectionPermissions } from "@/lib/site-sections";
import { SectionContentEditor } from "@/components/editors/SectionContentEditor";

interface HomeEditorProps {
  initialSections: SiteSection[];
  appUrl: string;
}

type ModalTab = "content" | "settings" | "permissions";

export function HomeEditor({ initialSections, appUrl }: HomeEditorProps) {
  const [sections, setSections] = useState<SiteSection[]>(initialSections);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<SectionType>("hero");
  const [draft, setDraft] = useState<SiteSection | null>(null);
  const [tab, setTab] = useState<ModalTab>("content");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/sections");
    const data = await res.json();
    if (res.ok && data.sections) setSections(data.sections);
  }

  async function run(body: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ ok: false, text: data.error || "Erro ao salvar." });
    }
    await refresh();
    setLoading(false);
  }

  function toggleSection(section: SiteSection) {
    run({ action: "toggle", id: section.id, enabled: !section.enabled });
  }

  function openEdit(section: SiteSection) {
    setDraft({
      ...section,
      permissions: normalizeSectionPermissions(section.permissions),
      settings: { ...(section.settings || {}) },
      content: JSON.parse(JSON.stringify(section.content || {})),
    });
    setEditingId(section.id);
    setTab("content");
  }

  function saveEdit() {
    if (!draft) return;
    run({ action: "update", ...draft });
    setEditingId(null);
    setDraft(null);
  }

  function duplicate(section: SiteSection) {
    run({ action: "duplicate", id: section.id });
  }

  function remove(section: SiteSection) {
    if (!confirm(`Excluir a seção "${section.label}"?`)) return;
    run({ action: "delete", id: section.id });
  }

  async function createSection() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", type: newType }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ ok: false, text: data.error || "Erro ao criar seção." });
    }
    await refresh();
    setLoading(false);
    setCreating(false);
    if (res.ok && data.section) openEdit(data.section);
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...sections];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setSections(next);
    run({ action: "reorder", ids: next.map((s) => s.id) });
    setDragIndex(null);
  }

  const editing = draft;

  return (
    <div className="space-y-4">
      {message && (
        <p className={`rounded-lg px-4 py-3 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{message.text}</p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          {sections.length} seções · arraste para reordenar
        </p>
        <div className="flex items-center gap-3">
          <a href="/" target="_blank" className="btn btn-outline !py-2 !px-4 text-xs">
            Ver HOME pública ↗
          </a>
          <button className="btn btn-primary !py-2 !px-4 text-xs" onClick={() => setCreating(true)}>
            + Nova seção
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {sections.map((section, idx) => {
          const perms = normalizeSectionPermissions(section.permissions);
          return (
            <div
              key={section.id}
              draggable={!loading}
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(idx)}
              className={`card !p-4 flex items-center gap-3 ${dragIndex === idx ? "opacity-50" : ""}`}
            >
              <span className="text-gray-300 cursor-grab select-none" title="Arrastar para reordenar">⠿</span>
              <span className="text-2xl">{SECTION_TYPE_ICONS[section.type as SectionType] || "📄"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{section.label}</span>
                  <span className="badge badge-gray">#{section.key}</span>
                  <span className="badge badge-blue">{section.type}</span>
                  {section.is_required && <span className="badge badge-yellow">Obrigatória</span>}
                  {!perms.can_edit && <span className="badge badge-gray">Bloqueada p/ usuário</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {section.title || section.subtitle || "Sem descrição"}
                </p>
              </div>
              <button
                onClick={() => toggleSection(section)}
                className={`relative w-10 h-6 rounded-full transition-colors ${section.enabled ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
                title={section.enabled ? "Desativar" : "Ativar"}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${section.enabled ? "left-[1.25rem]" : "left-0.5"}`} />
              </button>
              <button className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => openEdit(section)} disabled={loading}>
                Editar
              </button>
              <button className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => duplicate(section)} disabled={loading}>
                Duplicar
              </button>
              <button className="btn btn-outline !py-1.5 !px-3 !text-xs !text-red-600" onClick={() => remove(section)} disabled={loading || section.is_required}>
                Excluir
              </button>
            </div>
          );
        })}
      </div>

      {/* ---------- Modal nova seção ---------- */}
      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <h3 className="card-title mb-4">Criar nova seção</h3>
            <label className="label">Tipo de seção</label>
            <select className="input mb-4" value={newType} onChange={(e) => setNewType(e.target.value as SectionType)}>
              {SECTION_TYPES.map((t) => (
                <option key={t} value={t}>{SECTION_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button className="btn btn-outline" onClick={() => setCreating(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={createSection} disabled={loading}>
                {loading ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Modal editar ---------- */}
      {editing && editingId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-3xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title">Editar seção — {editing.label}</h3>
              <button className="text-gray-400 text-xl" onClick={() => { setEditingId(null); setDraft(null); }}>✕</button>
            </div>

            <div className="flex gap-1 mb-4">
              {(["content", "settings", "permissions"] as ModalTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium ${tab === t ? "bg-[#1d5c3a] text-white" : "bg-gray-100 text-gray-600"}`}
                >
                  {t === "content" ? "Conteúdo" : t === "settings" ? "Configurações" : "Permissões"}
                </button>
              ))}
            </div>

            {tab === "content" && (
              <div className="max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="label">Nome da seção (painel)</label>
                    <input className="input" value={editing.label} onChange={(e) => setDraft({ ...editing, label: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Título (padrão)</label>
                    <input className="input" value={editing.title || ""} onChange={(e) => setDraft({ ...editing, title: e.target.value || null })} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="label">Descrição (padrão)</label>
                  <input className="input" value={editing.subtitle || ""} onChange={(e) => setDraft({ ...editing, subtitle: e.target.value || null })} />
                </div>
                <SectionContentEditor
                  sectionType={editing.type as SectionType}
                  value={editing.content}
                  onChange={(content) => setDraft({ ...editing, content })}
                />
              </div>
            )}

            {tab === "settings" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(editing.enabled)} onChange={(e) => setDraft({ ...editing, enabled: e.target.checked })} />
                    Ativa
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(editing.is_required)} onChange={(e) => setDraft({ ...editing, is_required: e.target.checked })} />
                    Obrigatória
                  </label>
                </div>
                <div>
                  <label className="label">Mostrar no menu</label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editing.settings?.showInNav !== false}
                      onChange={(e) => setDraft({ ...editing, settings: { ...editing.settings, showInNav: e.target.checked } })}
                    />
                    Exibir link no menu
                  </label>
                </div>
                <div>
                  <label className="label">Rótulo no menu</label>
                  <input className="input" value={(editing.settings?.navLabel as string) || ""} onChange={(e) => setDraft({ ...editing, settings: { ...editing.settings, navLabel: e.target.value } })} />
                </div>
                <div>
                  <label className="label">Ordem (sort_order)</label>
                  <input
                    className="input"
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setDraft({ ...editing, sort_order: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}

            {tab === "permissions" && (
              <div className="space-y-2">
                <PermissionRow label="Usuário pode editar conteúdo" checked={editing.permissions.can_edit !== false} onChange={(v) => setPerm("can_edit", v)} />
                <PermissionRow label="Usuário pode ativar/desativar" checked={editing.permissions.can_toggle !== false} onChange={(v) => setPerm("can_toggle", v)} />
                <PermissionRow label="Usuário pode alterar imagem" checked={editing.permissions.can_edit_image !== false} onChange={(v) => setPerm("can_edit_image", v)} />
                <PermissionRow label="Usuário pode alterar vídeo" checked={editing.permissions.can_edit_video !== false} onChange={(v) => setPerm("can_edit_video", v)} />
                <PermissionRow label="Usuário pode alterar botão" checked={editing.permissions.can_edit_button !== false} onChange={(v) => setPerm("can_edit_button", v)} />
                <PermissionRow label="Usuário pode alterar cores" checked={editing.permissions.can_edit_colors !== false} onChange={(v) => setPerm("can_edit_colors", v)} />
                <PermissionRow label="Usuário pode alterar layout" checked={editing.permissions.can_edit_layout !== false} onChange={(v) => setPerm("can_edit_layout", v)} />
                <PermissionRow label="Disponível para todos os usuários" checked={editing.permissions.available_to_all !== false} onChange={(v) => setPerm("available_to_all", v)} />
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-outline" onClick={() => { setEditingId(null); setDraft(null); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={loading}>
                {loading ? "Salvando..." : "Salvar seção"}
              </button>
            </div>
          </div>
        </div>
      )}

      {appUrl && (
        <p className="text-xs text-gray-400">A HOME pública é renderizada a partir destas definições em <a href={appUrl} target="_blank" className="underline">{appUrl}</a> e em cada site /slug.</p>
      )}
    </div>
  );

  function setPerm(key: keyof SectionPermissions, value: boolean) {
    if (!draft) return;
    setDraft({ ...draft, permissions: { ...draft.permissions, [key]: value } });
  }
}

function PermissionRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm cursor-pointer">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
