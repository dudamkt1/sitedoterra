"use client";

import { useState } from "react";
import type { AiTool } from "@/types";
import { CATEGORY_LABELS } from "@/components/dashboard/AiCategories";

interface Props {
  initialTools: AiTool[];
}

export function AiToolsAdmin({ initialTools }: Props) {
  const [tools, setTools] = useState<AiTool[]>(initialTools);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<AiTool | null>(null);
  const [draft, setDraft] = useState<Partial<AiTool> | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const res = await fetch("/api/admin/ai/tools");
    const data = await res.json();
    if (res.ok && data.tools) setTools(data.tools);
  }

  async function run(body: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/ai/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) setMessage({ ok: false, text: data.error || "Erro ao salvar." });
    await refresh();
    setLoading(false);
  }

  function toggle(t: AiTool) {
    run({ action: "toggle", id: t.id, enabled: !t.enabled });
  }

  function openEdit(t: AiTool) {
    setEditing(t);
    setDraft({ ...t, examples: [...(t.examples || [])] });
  }

  async function create() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/ai/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: draft?.name || "Nova ferramenta",
        code: draft?.code || `ferramenta-${Date.now().toString(36)}`,
        emoji: draft?.emoji || "🤖",
        category: draft?.category || "conteudo",
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
    delete payload.fields;
    delete payload.generates_content;
    delete payload.created_at;
    delete payload.updated_at;
    run(payload);
    setEditing(null);
    setDraft(null);
  }

  function remove(t: AiTool) {
    if (!confirm(`Remover a ferramenta "${t.name}"? Essa ação não pode ser desfeita.`)) return;
    run({ action: "delete", id: t.id });
  }

  const field = (key: keyof AiTool, label: string, type: "text" | "textarea" = "text") => {
    if (!draft) return null;
    const value = (draft[key] as string) || "";
    return (
      <div>
        <label className="label">{label}</label>
        {type === "textarea" ? (
          <textarea className="input min-h-20" value={String(value)} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
        ) : (
          <input className="input" value={String(value)} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
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
        <button className="btn btn-primary !py-2 !px-4 text-xs" onClick={() => setCreating(true)}>+ Nova ferramenta</button>
      </div>

      <div className="space-y-2">
        {tools.map((t) => (
          <div key={t.id} className="card !p-4 flex items-center gap-3">
            <span className="text-2xl">{t.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{t.name}</span>
                <span className="badge badge-blue">#{t.code}</span>
                <span className="badge badge-gray">{CATEGORY_LABELS[t.category] || t.category}</span>
                <span className={`badge ${t.enabled ? "badge-green" : "badge-gray"}`}>{t.enabled ? "Ativo" : "Desativado"}</span>
                {t.requires_api_key && <span className="badge badge-yellow">usa IA</span>}
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
            <h3 className="card-title mb-4">Nova ferramenta</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Nome</label>
                <input className="input" value={draft?.name || ""} onChange={(e) => setDraft({ ...(draft || {}), name: e.target.value })} />
              </div>
              <div>
                <label className="label">Código (ex.: minha-ferramenta)</label>
                <input className="input" value={draft?.code || ""} onChange={(e) => setDraft({ ...(draft || {}), code: e.target.value })} />
              </div>
              <div>
                <label className="label">Emoji</label>
                <input className="input" value={draft?.emoji || ""} onChange={(e) => setDraft({ ...(draft || {}), emoji: e.target.value })} />
              </div>
              <div>
                <label className="label">Categoria</label>
                <select className="input" value={draft?.category || "conteudo"} onChange={(e) => setDraft({ ...(draft || {}), category: e.target.value })}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
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
          <div className="card w-full max-w-2xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title">Editar ferramenta — {editing.name}</h3>
              <button className="text-gray-400 text-xl" onClick={() => { setEditing(null); setDraft(null); }}>✕</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
              {field("name", "Nome")}
              {field("emoji", "Emoji")}
              <div>
                <label className="label">Categoria</label>
                <select className="input" value={draft.category || "conteudo"} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {field("description", "Descrição", "textarea")}
              <div>
                <label className="label">Exemplos (um por linha)</label>
                <textarea
                  className="input min-h-16"
                  value={(draft.examples || []).join("\n")}
                  onChange={(e) => setDraft({ ...draft, examples: e.target.value.split("\n").filter(Boolean) })}
                />
              </div>
              {field("base_prompt", "Instruções / base prompt (instruções de sistema da IA)", "textarea")}
              <div>
                <label className="label">Ordem (sort_order)</label>
                <input type="number" className="input" value={String(draft.sort_order || 0)} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.enabled !== false} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.requires_api_key !== false} onChange={(e) => setDraft({ ...draft, requires_api_key: e.target.checked })} />
                Exige API de IA configurada
              </label>
              <p className="text-xs text-gray-400">
                ⚠️ Os <strong>campos do formulário</strong> desta ferramenta são definidos no código (lib/ai-tools.ts).
                Se você criar uma ferramenta nova, ela terá o prompt padrão genérico. Para ferramentas conhecidas, o
                builder de prompt do código é usado automaticamente.
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-outline" onClick={() => { setEditing(null); setDraft(null); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}