"use client";

import { useState } from "react";
import type { AiProvider } from "@/types";

interface AiProvidersAdminProps {
  initialProviders: AiProvider[];
}

export function AiProvidersAdmin({ initialProviders }: AiProvidersAdminProps) {
  const [providers, setProviders] = useState<AiProvider[]>(initialProviders);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<AiProvider | null>(null);
  const [draft, setDraft] = useState<Partial<AiProvider> | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const res = await fetch("/api/admin/ai");
    const data = await res.json();
    if (res.ok && data.providers) setProviders(data.providers);
  }

  async function run(body: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) setMessage({ ok: false, text: data.error || "Erro ao salvar." });
    await refresh();
    setLoading(false);
  }

  function toggle(p: AiProvider) {
    run({ action: "toggle", id: p.id, enabled: !p.enabled });
  }

  function openEdit(p: AiProvider) {
    setEditing(p);
    setDraft({ ...p });
  }

  async function create() {
    setLoading(true);
    const res = await fetch("/api/admin/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name: draft?.name || "Novo provedor", code: draft?.code || `prov-${Date.now()}` }),
    });
    const data = await res.json();
    if (!res.ok) setMessage({ ok: false, text: data.error || "Erro ao criar." });
    await refresh();
    setLoading(false);
    setCreating(false);
  }

  function saveEdit() {
    if (!draft) return;
    run({ action: "update", ...draft });
    setEditing(null);
    setDraft(null);
  }

  const field = (key: keyof AiProvider, label: string, type: "text" | "textarea" = "text") => {
    if (!draft) return null;
    return (
      <div>
        <label className="label">{label}</label>
        {type === "textarea" ? (
          <textarea className="input min-h-20" value={String(draft[key] || "")} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
        ) : (
          <input className="input" value={String(draft[key] || "")} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
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
        <button className="btn btn-primary !py-2 !px-4 text-xs" onClick={() => setCreating(true)}>+ Novo provedor</button>
      </div>

      <div className="space-y-2">
        {providers.map((p) => (
          <div key={p.id} className="card !p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{p.name}</span>
                <span className="badge badge-blue">#{p.code}</span>
                <span className={`badge ${p.enabled ? "badge-green" : "badge-gray"}`}>{p.enabled ? "Ativo" : "Desativado"}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{p.model} · {p.base_url}</p>
            </div>
            <button
              onClick={() => toggle(p)}
              className={`relative w-10 h-6 rounded-full transition-colors ${p.enabled ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
              title={p.enabled ? "Desativar" : "Ativar"}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${p.enabled ? "left-[1.25rem]" : "left-0.5"}`} />
            </button>
            <button className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => openEdit(p)} disabled={loading}>
              Editar
            </button>
          </div>
        ))}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <h3 className="card-title mb-4">Novo provedor</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Nome</label>
                <input className="input" value={draft?.name || ""} onChange={(e) => setDraft({ ...(draft || {}), name: e.target.value })} />
              </div>
              <div>
                <label className="label">Código (ex.: meu-provedor)</label>
                <input className="input" value={draft?.code || ""} onChange={(e) => setDraft({ ...(draft || {}), code: e.target.value })} />
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
              <h3 className="card-title">Editar provedor — {editing.name}</h3>
              <button className="text-gray-400 text-xl" onClick={() => { setEditing(null); setDraft(null); }}>✕</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
              {field("name", "Nome")}
              {field("model", "Modelo")}
              {field("base_url", "Base URL")}
              {field("docs_url", "URL da documentação (como obter a chave)")}
              {field("free_tier", "Descrição do plano gratuito", "textarea")}
              {field("limits", "Limites informativos", "textarea")}
              {field("instructions", "Instruções para o usuário", "textarea")}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.requires_api_key} onChange={(e) => setDraft({ ...draft, requires_api_key: e.target.checked })} />
                Exige API Key do usuário
              </label>
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
