"use client";

import { useState } from "react";
import type { AiTemplate, AiTemplateStructure, AiTemplateField } from "@/types";

interface Props {
  initialTemplates: AiTemplate[];
}

export function AiTemplatesAdmin({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState<AiTemplate[]>(initialTemplates);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<AiTemplate | null>(null);
  const [draft, setDraft] = useState<Partial<AiTemplate> | null>(null);
  const [structureDraft, setStructureDraft] = useState<AiTemplateStructure | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const res = await fetch("/api/admin/ai/templates");
    const data = await res.json();
    if (res.ok && data.templates) setTemplates(data.templates);
  }

  async function run(body: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/ai/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) setMessage({ ok: false, text: data.error || "Erro ao salvar." });
    await refresh();
    setLoading(false);
  }

  function toggle(t: AiTemplate) {
    run({ action: "toggle", id: t.id, enabled: !t.enabled });
  }

  function openEdit(t: AiTemplate) {
    setEditing(t);
    setDraft({ ...t });
    setStructureDraft(JSON.parse(JSON.stringify(t.structure || { layout: "story", fields: [] })));
  }

  async function create() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/ai/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: draft?.name || "Novo template",
        code: draft?.code || `template-${Date.now().toString(36)}`,
        emoji: draft?.emoji || "🎨",
        category: draft?.category || "redes",
        description: draft?.description || "",
      }),
    });
    const data = await res.json();
    if (!res.ok) setMessage({ ok: false, text: data.error || "Erro ao criar." });
    await refresh();
    setLoading(false);
    setCreating(false);
  }

  function saveEdit() {
    if (!draft) return;
    const payload: Record<string, unknown> = { action: "update", ...draft };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    if (structureDraft) payload.structure = structureDraft;
    run(payload);
    setEditing(null);
    setDraft(null);
    setStructureDraft(null);
  }

  function remove(t: AiTemplate) {
    if (!confirm(`Remover o template "${t.name}"?`)) return;
    run({ action: "delete", id: t.id });
  }

  function updateField(index: number, patch: Partial<{ key: string; label: string; type: AiTemplateField["type"]; default: string; options: string[] }>) {
    if (!structureDraft) return;
    const fields = [...(structureDraft.fields || [])];
    fields[index] = { ...fields[index], ...patch } as AiTemplateField;
    setStructureDraft({ ...structureDraft, fields });
  }

  function addField() {
    if (!structureDraft) return;
    setStructureDraft({
      ...structureDraft,
      fields: [...(structureDraft.fields || []), { key: `campo${Date.now()}`, label: "Novo campo", type: "text", default: "" }],
    });
  }

  function removeField(index: number) {
    if (!structureDraft) return;
    const fields = (structureDraft.fields || []).filter((_, i) => i !== index);
    setStructureDraft({ ...structureDraft, fields });
  }

  const textField = (key: keyof AiTemplate, label: string, type: "text" | "textarea" = "text") => {
    if (!draft) return null;
    return (
      <div>
        <label className="label">{label}</label>
        {type === "textarea" ? (
          <textarea className="input min-h-16" value={String((draft[key] as string) || "")} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
        ) : (
          <input className="input" value={String((draft[key] as string) || "")} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {message && (
        <p className={`rounded-lg px-4 py-3 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{message.text}</p>
      )}

      <div className="flex justify-end">
        <button className="btn btn-primary !py-2 !px-4 text-xs" onClick={() => setCreating(true)}>+ Novo template</button>
      </div>

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="card !p-4 flex items-center gap-3">
            <span className="text-2xl">{t.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{t.name}</span>
                <span className="badge badge-blue">#{t.code}</span>
                <span className={`badge ${t.enabled ? "badge-green" : "badge-gray"}`}>{t.enabled ? "Ativo" : "Desativado"}</span>
                <span className="badge badge-gray">{t.structure?.layout || "story"}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>
            </div>
            <button
              onClick={() => toggle(t)}
              className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${t.enabled ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
              title={t.enabled ? "Desativar" : "Ativar"}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${t.enabled ? "left-[1.25rem]" : "left-0.5"}`} />
            </button>
            <button className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => openEdit(t)} disabled={loading}>Editar</button>
            <button className="btn btn-outline !py-1.5 !px-3 !text-xs text-red-500" onClick={() => remove(t)} disabled={loading}>🗑</button>
          </div>
        ))}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <h3 className="card-title mb-4">Novo template</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Nome</label>
                <input className="input" value={draft?.name || ""} onChange={(e) => setDraft({ ...(draft || {}), name: e.target.value })} />
              </div>
              <div>
                <label className="label">Código (ex.: meu-template)</label>
                <input className="input" value={draft?.code || ""} onChange={(e) => setDraft({ ...(draft || {}), code: e.target.value })} />
              </div>
              <div>
                <label className="label">Emoji</label>
                <input className="input" value={draft?.emoji || ""} onChange={(e) => setDraft({ ...(draft || {}), emoji: e.target.value })} />
              </div>
              <div>
                <label className="label">Categoria</label>
                <input className="input" value={draft?.category || "redes"} onChange={(e) => setDraft({ ...(draft || {}), category: e.target.value })} />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea className="input min-h-16" value={draft?.description || ""} onChange={(e) => setDraft({ ...(draft || {}), description: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-outline" onClick={() => setCreating(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={create} disabled={loading}>{loading ? "Criando..." : "Criar"}</button>
            </div>
          </div>
        </div>
      )}

      {editing && draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-3xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title">Editar template — {editing.name}</h3>
              <button className="text-gray-400 text-xl" onClick={() => { setEditing(null); setDraft(null); setStructureDraft(null); }}>✕</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
              {textField("name", "Nome")}
              {textField("emoji", "Emoji")}
              {textField("category", "Categoria")}
              {textField("description", "Descrição", "textarea")}
              <div>
                <label className="label">Layout</label>
                <select
                  className="input"
                  value={structureDraft?.layout || "story"}
                  onChange={(e) => setStructureDraft((s) => ({ ...(s || { fields: [] }), layout: e.target.value as "story" | "carrossel" }))}
                >
                  <option value="story">Story (9:16)</option>
                  <option value="carrossel">Carrossel (4:5)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Campos editáveis do template</label>
                  <button className="btn btn-outline !py-1 !px-3 !text-xs" onClick={addField}>+ Campo</button>
                </div>
                {(structureDraft?.fields || []).map((f, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3 mb-2 grid grid-cols-2 gap-2">
                    <input className="input !py-1.5 text-xs" placeholder="chave (key)" value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} />
                    <input className="input !py-1.5 text-xs" placeholder="Rótulo (label)" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} />
                    <select className="input !py-1.5 text-xs" value={f.type || "text"} onChange={(e) => updateField(i, { type: e.target.value as AiTemplateField["type"] })}>
                      <option value="text">Texto</option>
                      <option value="textarea">Texto longo</option>
                      <option value="color">Cor</option>
                      <option value="image">Imagem</option>
                      <option value="select">Lista</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <input className="input !py-1.5 text-xs" placeholder="Valor padrão" value={f.default || ""} onChange={(e) => updateField(i, { default: e.target.value })} />
                      <button className="text-red-500 text-sm px-1" onClick={() => removeField(i)} title="Remover campo">✕</button>
                    </div>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.enabled !== false} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                Ativo
              </label>
              <p className="text-xs text-gray-400">
                ⚠️ Crie/edite campos seguindo o padrão das chaves já usadas pelo editor (title, subtitle, body, cta,
                hashtags, bgColor, textColor, accentColor, image, logo, position).
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-outline" onClick={() => { setEditing(null); setDraft(null); setStructureDraft(null); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}