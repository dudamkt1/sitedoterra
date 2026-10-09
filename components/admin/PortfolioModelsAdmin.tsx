"use client";

import { useState } from "react";
import type { SectionPermissions, SectionType } from "@/types";
import {
  SECTION_TYPE_ICONS,
  normalizeSectionPermissions,
} from "@/lib/site-sections";
import { SectionContentEditor } from "@/components/editors/SectionContentEditor";
import { MediaPicker } from "@/components/media/MediaPicker";
import type { PortfolioModel, PortfolioModelSection } from "@/lib/portfolio";

interface Props {
  initialModels: PortfolioModel[];
}

type Message = { ok: boolean; text: string } | null;

type NewForm = {
  name: string;
  key: string;
  company: string;
  category: string;
  description: string;
  copyFrom: string;
};

const EMPTY_NEW: NewForm = {
  name: "",
  key: "",
  company: "",
  category: "",
  description: "",
  copyFrom: "",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * Campo de imagem (capa / miniatura) com ENVIO de mídia e prévia do encaixe.
 *
 * Além da URL, o botão abre a biblioteca do sistema (upload para o Cloudflare
 * R2). A prévia replica o cartão real do portfólio: proporção 16/11 com a
 * "barra de navegador" no topo e corte pelo topo da imagem
 * (`object-position: top center` em `site.css`) — assim o Super Admin vê
 * exatamente como a foto vai ficar antes de salvar.
 */
function ImageField({
  label,
  value,
  onChange,
  recommended,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  recommended: string;
}) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          className="input"
          type="text"
          value={value}
          placeholder="https://... ou envie um arquivo"
          onChange={(e) => onChange(e.target.value)}
        />
        <MediaPicker
          scope="system"
          value={value || undefined}
          onChange={(url) => onChange(url)}
          label="Enviar mídia"
        />
      </div>

      <div className="mt-2 flex items-start gap-3">
        {/* Prévia do encaixe — mesmo formato do cartão da listagem */}
        <div className="w-[168px] shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-col" style={{ aspectRatio: "16 / 11" }}>
            <div className="flex h-[16px] shrink-0 items-center gap-1 border-b border-gray-200 bg-[#f1f3f5] px-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
            </div>
            <div className="relative flex-1 overflow-hidden bg-gray-100">
              {value ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={value}
                  alt="Prévia do encaixe"
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  referrerPolicy="no-referrer"
                  onLoad={(e) =>
                    setDims({
                      w: e.currentTarget.naturalWidth,
                      h: e.currentTarget.naturalHeight,
                    })
                  }
                  onError={() => setDims(null)}
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-2xl text-gray-300">
                  🖼️
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 text-[11.5px] leading-4 text-gray-500">
          <p>
            <strong className="text-gray-700">Melhor encaixe:</strong> proporção{" "}
            <strong className="text-gray-700">16:11</strong> — recomendado{" "}
            <strong className="text-gray-700">{recommended}</strong>. O recorte
            começa pelo topo da imagem.
          </p>
          {value && dims && (
            <p className="mt-1.5">
              Arquivo atual: <strong>{dims.w}×{dims.h} px</strong>
              {Math.abs(dims.w / dims.h - 16 / 11) > 0.08
                ? " — fora da proporção ideal, as laterais/topo serão cortadas."
                : " — proporção ideal."}
            </p>
          )}
          <p className="mt-1.5 text-gray-400">
            Use o botão ao lado para enviar um arquivo (PNG/JPG/WEBP) ou escolher
            na biblioteca.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * CRUD do PORTFÓLIO DE MODELOS (Super Admin).
 *
 * Um modelo guarda uma estrutura de seções em jsonb (cópia do template). Na
 * ativação, essa estrutura é copiada linha a linha para o novo site e os
 * dois passam a ser independentes — por isso editar aqui não tem efeito
 * retroativo em sites já criados.
 */
export function PortfolioModelsAdmin({ initialModels }: Props) {
  const [models, setModels] = useState<PortfolioModel[]>(initialModels);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewForm>(EMPTY_NEW);
  const [draft, setDraft] = useState<PortfolioModel | null>(null);
  const [tab, setTab] = useState<"data" | "sections">("data");
  const [sectionDraft, setSectionDraft] = useState<PortfolioModelSection | null>(null);
  const [sectionIndex, setSectionIndex] = useState<number | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/admin/portfolio-models", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.models)) setModels(data.models as PortfolioModel[]);
    } catch {
      // silencioso
    }
  }

  async function run(body: Record<string, unknown>): Promise<boolean> {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/portfolio-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: data.error || "Erro ao salvar." });
        await refresh();
        setLoading(false);
        return false;
      }
      await refresh();
      setLoading(false);
      return true;
    } catch {
      setMessage({ ok: false, text: "Erro de conexão ao salvar." });
      setLoading(false);
      return false;
    }
  }

  async function createModel() {
    if (!form.name.trim()) {
      setMessage({ ok: false, text: "Informe o nome do modelo." });
      return;
    }
    const ok = await run({
      action: "create",
      name: form.name,
      key: form.key,
      company: form.company,
      category: form.category,
      description: form.description,
      copyFrom: form.copyFrom,
    });
    if (ok) {
      setCreating(false);
      setForm(EMPTY_NEW);
      setMessage({ ok: true, text: "Modelo criado. Revise as seções antes de publicar." });
    }
  }

  function openEdit(model: PortfolioModel) {
    setDraft({
      ...model,
      sections: JSON.parse(JSON.stringify(model.sections || [])),
      site_data: JSON.parse(JSON.stringify(model.site_data || {})),
    });
    setTab("data");
  }

  function setField(key: keyof PortfolioModel, value: unknown) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value } as PortfolioModel);
  }

  async function saveModel() {
    if (!draft) return;
    const ok = await run({
      action: "update",
      id: draft.id,
      key: draft.key,
      name: draft.name,
      company: draft.company,
      category: draft.category,
      description: draft.description,
      thumbnail_url: draft.thumbnail_url,
      cover_url: draft.cover_url,
      demo_url: draft.demo_url,
      status: draft.status,
      is_selectable: draft.is_selectable,
      sort_order: draft.sort_order,
      site_data: draft.site_data,
      sections: draft.sections,
    });
    if (ok) {
      setDraft(null);
      setMessage({ ok: true, text: "Modelo salvo." });
    }
  }

  async function duplicate(model: PortfolioModel) {
    const ok = await run({ action: "duplicate", id: model.id });
    if (ok) setMessage({ ok: true, text: "Cópia criada em modo rascunho." });
  }

  async function setDefault(model: PortfolioModel) {
    const ok = await run({ action: "set-default", id: model.id });
    if (ok) setMessage({ ok: true, text: `"${model.name}" agora é o Modelo Padrão.` });
  }

  async function remove(model: PortfolioModel) {
    if (!confirm(`Excluir o modelo "${model.name}"?`)) return;
    const ok = await run({ action: "delete", id: model.id });
    if (ok) setMessage({ ok: true, text: "Modelo excluído." });
  }

  // ---------- seções do modelo em edição ----------
  function moveSection(index: number, dir: -1 | 1) {
    if (!draft) return;
    const next = [...draft.sections];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((s, i) => (s.sort_order = (i + 1) * 10));
    setDraft({ ...draft, sections: next });
  }

  function toggleSection(index: number) {
    if (!draft) return;
    const next = [...draft.sections];
    next[index] = { ...next[index], enabled: next[index].enabled === false };
    setDraft({ ...draft, sections: next });
  }

  function openSection(index: number) {
    if (!draft) return;
    const s = draft.sections[index];
    setSectionDraft({
      ...s,
      settings: { ...(s.settings || {}) },
      content: JSON.parse(JSON.stringify(s.content || {})),
      permissions: normalizeSectionPermissions(s.permissions),
    });
    setSectionIndex(index);
  }

  function saveSection() {
    if (!draft || sectionDraft === null || sectionIndex === null) return;
    const next = [...draft.sections];
    next[sectionIndex] = {
      ...sectionDraft,
      permissions: normalizeSectionPermissions(sectionDraft.permissions),
    };
    setDraft({ ...draft, sections: next });
    setSectionDraft(null);
    setSectionIndex(null);
  }

  function setSectionField<K extends keyof PortfolioModelSection>(
    key: K,
    value: PortfolioModelSection[K]
  ) {
    if (!sectionDraft) return;
    setSectionDraft({ ...sectionDraft, [key]: value });
  }

  function setSectionPerm(key: keyof SectionPermissions, value: boolean) {
    if (!sectionDraft) return;
    setSectionDraft({
      ...sectionDraft,
      permissions: { ...sectionDraft.permissions, [key]: value },
    });
  }

  const editing = draft;

  return (
    <div className="space-y-4">
      {message && (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          {models.length} modelos · um deles é o padrão da ativação
        </p>
        <div className="flex items-center gap-3">
          <a href="/portfolio" target="_blank" className="btn btn-outline !py-2 !px-4 text-xs">
            Ver portfólio ↗
          </a>
          <button className="btn btn-primary !py-2 !px-4 text-xs" onClick={() => { setForm(EMPTY_NEW); setCreating(true); }}>
            + Novo modelo
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {models.map((m) => (
          <div key={m.id} className="card !p-4 flex items-center gap-3 flex-wrap">
            <span className="text-2xl">🧩</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{m.name}</span>
                <span className="badge badge-gray">#{m.key}</span>
                {m.company && <span className="badge badge-blue">{m.company}</span>}
                {m.is_default && <span className="badge badge-yellow">Padrão</span>}
                {m.status !== "active" && <span className="badge badge-gray">Rascunho</span>}
                {!m.is_selectable && <span className="badge badge-gray">Oculto na escolha</span>}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {m.description || "Sem descrição"} · {m.sections?.length || 0} seções
              </p>
            </div>
            <a
              className="btn btn-outline !py-1.5 !px-3 !text-xs"
              href={`/portfolio/${m.key}`}
              target="_blank"
            >
              Demo ↗
            </a>
            <button className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => openEdit(m)} disabled={loading}>
              Editar
            </button>
            <button className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => duplicate(m)} disabled={loading}>
              Duplicar
            </button>
            {!m.is_default && (
              <button className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => setDefault(m)} disabled={loading}>
                Tornar padrão
              </button>
            )}
            <button
              className="btn btn-outline !py-1.5 !px-3 !text-xs !text-red-600"
              onClick={() => remove(m)}
              disabled={loading || m.is_default}
            >
              Excluir
            </button>
          </div>
        ))}
        {models.length === 0 && (
          <div className="card !p-6 text-sm text-gray-500">
            Nenhum modelo cadastrado. Crie o primeiro — ele nasce com a estrutura atual do template.
          </div>
        )}
      </div>

      {/* ---------- Modal novo modelo ---------- */}
      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg">
            <h3 className="card-title mb-4">Novo modelo de site</h3>
            <div className="space-y-3">
              <Field label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Modelo AMAKHA" />
              <Field label="Chave (URL do modelo)" value={form.key} onChange={(v) => setForm({ ...form, key: v })} placeholder="amakha" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Empresa / marca" value={form.company} onChange={(v) => setForm({ ...form, company: v })} placeholder="AMAKHA" />
                <Field label="Categoria" value={form.category} onChange={(v) => setForm({ ...form, category: v })} placeholder="Cosméticos naturais" />
              </div>
              <div>
                <label className="label">Descrição (aparece no card)</label>
                <textarea
                  className="input"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Estrutura inicial</label>
                <select className="input" value={form.copyFrom} onChange={(e) => setForm({ ...form, copyFrom: e.target.value })}>
                  <option value="">Estrutura padrão da plataforma</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.key}>
                      Copiar de: {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-outline" onClick={() => setCreating(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={createModel} disabled={loading}>
                {loading ? "Criando..." : "Criar modelo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Modal editar modelo ---------- */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-4xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title">Editar modelo — {editing.name}</h3>
              <button className="text-gray-400 text-xl" onClick={() => setDraft(null)}>✕</button>
            </div>

            <div className="flex gap-1 mb-4">
              {(["data", "sections"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                    tab === t ? "bg-[#1d5c3a] text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {t === "data" ? "Dados" : `Seções (${editing.sections.length})`}
                </button>
              ))}
            </div>

            {tab === "data" && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome" value={editing.name} onChange={(v) => setField("name", v)} />
                  <Field label="Chave" value={editing.key} onChange={(v) => setField("key", v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Empresa / marca" value={editing.company || ""} onChange={(v) => setField("company", v || null)} />
                  <Field label="Categoria" value={editing.category || ""} onChange={(v) => setField("category", v || null)} />
                </div>
                <div>
                  <label className="label">Descrição</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={editing.description || ""}
                    onChange={(e) => setField("description", e.target.value || null)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ImageField
                    label="Imagem de capa"
                    value={editing.cover_url || ""}
                    onChange={(v) => setField("cover_url", v || null)}
                    recommended="1600 × 1100 px"
                  />
                  <ImageField
                    label="Miniatura"
                    value={editing.thumbnail_url || ""}
                    onChange={(v) => setField("thumbnail_url", v || null)}
                    recommended="800 × 550 px"
                  />
                </div>
                <Field label="Link da demonstração (opcional)" value={editing.demo_url || ""} onChange={(v) => setField("demo_url", v || null)} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Situação</label>
                    <select className="input" value={editing.status} onChange={(e) => setField("status", e.target.value)}>
                      <option value="active">Publicado</option>
                      <option value="draft">Rascunho (oculto)</option>
                    </select>
                  </div>
                  <Field label="Ordem na lista" value={String(editing.sort_order ?? 0)} onChange={(v) => setField("sort_order", Number(v) || 0)} type="number" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.is_selectable !== false}
                    onChange={(e) => setField("is_selectable", e.target.checked)}
                  />
                  Disponível na escolha do novo consultor
                </label>
              </div>
            )}

            {tab === "sections" && (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                {editing.sections.map((s, i) => (
                  <div key={`${s.key}-${i}`} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <span className="text-xl">{SECTION_TYPE_ICONS[s.type as SectionType] || "📄"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{s.label}</span>
                        <span className="badge badge-gray">#{s.key}</span>
                        <span className="badge badge-blue">{s.type}</span>
                      </div>
                    </div>
                    <button className="text-sm text-gray-400 px-1" onClick={() => moveSection(i, -1)} title="Subir" disabled={i === 0}>↑</button>
                    <button className="text-sm text-gray-400 px-1" onClick={() => moveSection(i, 1)} title="Descer" disabled={i === editing.sections.length - 1}>↓</button>
                    <button
                      onClick={() => toggleSection(i)}
                      className={`relative w-10 h-6 rounded-full transition-colors ${s.enabled ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
                      title={s.enabled ? "Desativar" : "Ativar"}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${s.enabled ? "left-[1.25rem]" : "left-0.5"}`} />
                    </button>
                    <button className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => openSection(i)}>
                      Editar
                    </button>
                  </div>
                ))}
                <p className="text-xs text-gray-400 pt-2">
                  A estrutura acima é o que o site novo recebe na ativação. Alterações aqui não afetam
                  sites já criados.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-outline" onClick={() => setDraft(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveModel} disabled={loading}>
                {loading ? "Salvando..." : "Salvar modelo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Modal editar seção do modelo ---------- */}
      {sectionDraft && sectionIndex !== null && editing && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-3xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title">Seção — {sectionDraft.label}</h3>
              <button
                className="text-gray-400 text-xl"
                onClick={() => { setSectionDraft(null); setSectionIndex(null); }}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Nome da seção (painel)</label>
                <input className="input" value={sectionDraft.label} onChange={(e) => setSectionField("label", e.target.value)} />
              </div>
              <div>
                <label className="label">Título (padrão)</label>
                <input className="input" value={sectionDraft.title || ""} onChange={(e) => setSectionField("title", e.target.value || null)} />
              </div>
            </div>
            <div className="mb-3">
              <label className="label">Descrição (padrão)</label>
              <input className="input" value={sectionDraft.subtitle || ""} onChange={(e) => setSectionField("subtitle", e.target.value || null)} />
            </div>

            <div className="max-h-[55vh] overflow-y-auto pr-2">
              <SectionContentEditor
                sectionType={sectionDraft.type as SectionType}
                value={sectionDraft.content}
                onChange={(content) => setSectionField("content", content)}
                mediaScope="system"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sectionDraft.settings?.showInNav !== false}
                  onChange={(e) =>
                    setSectionField("settings", { ...sectionDraft.settings, showInNav: e.target.checked })
                  }
                />
                Mostrar no menu
              </label>
              <div>
                <label className="label">Rótulo no menu</label>
                <input
                  className="input"
                  value={(sectionDraft.settings?.navLabel as string) || ""}
                  onChange={(e) =>
                    setSectionField("settings", { ...sectionDraft.settings, navLabel: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <PermissionRow label="Usuário pode editar conteúdo" checked={sectionDraft.permissions.can_edit !== false} onChange={(v) => setSectionPerm("can_edit", v)} />
              <PermissionRow label="Usuário pode ativar/desativar" checked={sectionDraft.permissions.can_toggle !== false} onChange={(v) => setSectionPerm("can_toggle", v)} />
              <PermissionRow label="Usuário pode alterar imagem" checked={sectionDraft.permissions.can_edit_image !== false} onChange={(v) => setSectionPerm("can_edit_image", v)} />
              <PermissionRow label="Disponível para todos" checked={sectionDraft.permissions.available_to_all !== false} onChange={(v) => setSectionPerm("available_to_all", v)} />
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-outline" onClick={() => { setSectionDraft(null); setSectionIndex(null); }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={saveSection}>
                Salvar seção
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm cursor-pointer">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
