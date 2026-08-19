"use client";

import { useEffect, useState } from "react";
import type { SectionPermissions, SectionType } from "@/types";
import { SECTION_TYPE_ICONS } from "@/lib/site-sections";
import { SectionContentEditor } from "@/components/editors/SectionContentEditor";

interface SectionView {
  id: string;
  key: string;
  type: SectionType;
  label: string;
  anchor: string;
  navLabel?: string;
  is_required: boolean;
  enabled: boolean;
  has_override: boolean;
  tenant_content: Record<string, unknown>;
  content: Record<string, unknown>;
  permissions: SectionPermissions;
  can_toggle: boolean;
  can_edit: boolean;
}

interface ApiResponse {
  sections: SectionView[];
  tenant: { id: string; slug: string; site_status: string };
  isSuperAdmin: boolean;
}

export function SiteSectionsManager({ slug, appUrl }: { slug: string; appUrl: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<SectionView | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  async function load() {
    const res = await fetch("/api/sections");
    const json = await res.json();
    if (res.ok) setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(section: SectionView) {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", sectionId: section.id, enabled: !section.enabled }),
    });
    const json = await res.json();
    if (!res.ok) setMessage({ ok: false, text: json.error || "Erro ao alterar a seção." });
    await load();
    setSaving(false);
  }

  function openEdit(section: SectionView) {
    setEditing(section);
    // Sempre parte do conteúdo EFETIVO (o mesmo que aparece no site público),
    // incluindo os dados vindos de "Informações do site" (site_settings).
    setDraft(JSON.parse(JSON.stringify(section.content)));
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", sectionId: editing.id, content: draft }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage({ ok: false, text: json.error || "Erro ao salvar a seção." });
    } else {
      setMessage({ ok: true, text: "Seção salva! Veja as alterações na página pública." });
    }
    await load();
    setSaving(false);
    setEditing(null);
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando seções...</p>;

  return (
    <div className="space-y-4">
      {message && (
        <p className={`rounded-lg px-4 py-3 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{message.text}</p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Estas são as seções da sua HOME. As permissões de edição são definidas pela plataforma.
        </p>
        {slug && (
          <a href={`/${slug}`} target="_blank" className="btn btn-outline !py-2 !px-4 text-xs">
            Visualizar site ↗
          </a>
        )}
      </div>

      <div className="space-y-2">
        {data?.sections.filter((s) => s.type !== "header" && s.type !== "footer").map((section) => {
          const isOn = section.enabled;
          return (
            <div key={section.id} className="card !p-4 flex items-center gap-3">
              <span className="text-2xl">{SECTION_TYPE_ICONS[section.type] || "📄"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{section.label}</span>
                  {section.is_required && <span className="badge badge-yellow">Obrigatória</span>}
                  {section.has_override && <span className="badge badge-blue">Personalizada</span>}
                  {!section.can_edit && <span className="badge badge-gray">Somente leitura</span>}
                  {!section.can_toggle && <span className="badge badge-gray">Ativação fixa</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isOn ? "Ativa" : "Desativada"} · {section.anchor}
                </p>
              </div>
              {section.can_toggle ? (
                <button
                  type="button"
                  onClick={() => toggle(section)}
                  disabled={saving}
                  className={`relative w-10 h-6 rounded-full transition-colors ${isOn ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
                  title={isOn ? "Desativar seção" : "Ativar seção"}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${isOn ? "left-[1.25rem]" : "left-0.5"}`} />
                </button>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
              {section.can_edit ? (
                <button type="button" className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => openEdit(section)} disabled={saving}>
                  Editar
                </button>
              ) : (
                <button type="button" className="btn btn-outline !py-1.5 !px-3 !text-xs" disabled>
                  Bloqueada
                </button>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-3xl my-8">
            <div className="flex items-center justify-between mb-1">
              <h3 className="card-title">Editar — {editing.label}</h3>
              <button type="button" className="text-gray-400 text-xl" onClick={() => setEditing(null)}>✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {editing.can_edit ? "Salve suas alterações para refletir na página pública." : "Você não tem permissão para editar esta seção."}
            </p>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <SectionContentEditor sectionType={editing.type} value={draft} onChange={setDraft} mediaScope="tenant" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? "Salvando..." : "Salvar seção"}
              </button>
            </div>
          </div>
        </div>
      )}

      {appUrl && slug && (
        <p className="text-xs text-gray-400">
          Página pública: <a href={`${appUrl}/${slug}`} target="_blank" className="underline text-[#1d5c3a]">{appUrl}/{slug} ↗</a>
        </p>
      )}
    </div>
  );
}
