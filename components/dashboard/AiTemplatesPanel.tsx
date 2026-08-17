"use client";

import { useState } from "react";
import type { AiTemplate, AiUserTemplate, AiTemplateField } from "@/types";

interface Props {
  templates: AiTemplate[];
  userTemplates: AiUserTemplate[];
  onSavedTemplate: (t: AiUserTemplate) => void;
}

function defaultValues(structure: AiTemplate["structure"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of structure.fields || []) {
    out[f.key] = f.default || (f.options?.[0] || "");
  }
  return out;
}

/** Renderiza a prévia visual do template com os valores atuais. */
function TemplatePreview({
  template,
  values,
}: {
  template: AiTemplate;
  values: Record<string, string>;
}) {
  const layout = template.structure?.layout || "story";
  const bg = values.bgColor || "#1d5c3a";
  const text = values.textColor || "#ffffff";
  const accent = values.accentColor || "#c4963a";
  const position = values.position || "center";
  const align = position === "top" ? "flex-start" : position === "bottom" ? "flex-end" : "center";

  const isCarrossel = layout === "carrossel";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm ${isCarrossel ? "aspect-[4/5]" : "aspect-[9/16]"} w-full`}
      style={{ background: bg, color: text }}
    >
      {values.image && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={values.image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          referrerPolicy="no-referrer"
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center gap-2" style={{ justifyContent: align, paddingTop: align === "flex-start" ? 24 : undefined, paddingBottom: align === "flex-end" ? 24 : undefined }}>
        {values.logo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={values.logo} alt="Logo" className="h-8 w-auto object-contain max-w-[70%]" referrerPolicy="no-referrer" />
        )}
        {values.title && (
          <p className="text-[0.65rem] uppercase tracking-[0.2em] font-semibold" style={{ color: accent }}>
            {values.title}
          </p>
        )}
        {values.subtitle && (
          <h3 className="text-xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{values.subtitle}</h3>
        )}
        {values.body && <p className="text-[0.7rem] leading-relaxed max-w-[90%] opacity-90 whitespace-pre-line">{values.body}</p>}
        {values.cta && (
          <span className="mt-1 rounded-full px-4 py-1.5 text-[0.65rem] font-bold" style={{ background: accent, color: bg }}>
            {values.cta}
          </span>
        )}
        {values.hashtags && (
          <p className="text-[0.55rem] opacity-70 mt-1">{values.hashtags}</p>
        )}
      </div>
      <div className="absolute top-3 left-3 text-[0.6rem] px-2 py-0.5 rounded-full bg-black/30 text-white/90">
        {template.emoji} {template.name}
      </div>
    </div>
  );
}

function TemplateEditor({
  template,
  initial,
  onClose,
  onSave,
  onSavedUserTemplate,
}: {
  template: AiTemplate;
  initial: Record<string, string>;
  onClose: () => void;
  onSave: (name: string) => Promise<boolean>;
  onSavedUserTemplate: (t: AiUserTemplate) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fields = template.structure?.fields || [];

  async function copyText() {
    const lines = [
      values.title ? `${values.title}` : null,
      values.subtitle ? `**${values.subtitle}**` : null,
      values.body,
      values.cta ? `👉 ${values.cta}` : null,
      values.hashtags,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  async function saveToMine() {
    const name = savedName.trim() || `${template.name} (meu)`;
    setSaving(true);
    const res = await fetch("/api/ai/user-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_code: template.code, name, data: values }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok && json.template) {
      onSavedUserTemplate(json.template);
      setMsg({ ok: true, text: "Template salvo na sua área 'Meus templates'." });
    } else {
      setMsg({ ok: false, text: json.error || "Erro ao salvar o template." });
    }
  }

  const renderField = (f: AiTemplateField) => {
    const value = values[f.key] ?? "";
    if (f.type === "color") {
      return (
        <div key={f.key} className="flex items-center gap-2">
          <label className="label mb-0 flex-1">{f.label}</label>
          <input
            type="color"
            className="h-9 w-14 rounded border border-gray-200 bg-white cursor-pointer"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#1d5c3a"}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        </div>
      );
    }
    if (f.type === "image") {
      return (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          <input
            className="input"
            placeholder="Cole a URL da imagem (ou deixe vazio)"
            value={value}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        </div>
      );
    }
    if (f.type === "select") {
      return (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          <select className="input" value={value} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
            {f.options?.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      );
    }
    if (f.type === "textarea") {
      return (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          <textarea className="input min-h-20" value={value} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
        </div>
      );
    }
    return (
      <div key={f.key}>
        <label className="label">{f.label}</label>
        <input className="input" value={value} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-4xl my-8">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="card-title">{template.emoji} {template.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Edite texto, cores, imagem, logo e posição. A prévia atualiza em tempo real.</p>
          </div>
          <button className="text-gray-400 text-xl" onClick={onClose}>✕</button>
        </div>

        {msg && (
          <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="max-w-xs mx-auto w-full">
            <TemplatePreview template={template} values={values} />
          </div>

          <div className="space-y-3">
            {fields.map(renderField)}

            <div>
              <label className="label">Nome para salvar (opcional)</label>
              <input className="input" placeholder={`Ex.: ${template.name} — minha versão`} value={savedName} onChange={(e) => setSavedName(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn btn-primary !py-2 !px-4 text-xs" onClick={copyText}>
                {copied ? "✓ Copiado!" : "📋 Copiar conteúdo"}
              </button>
              <button className="btn btn-gold !py-2 !px-4 text-xs" onClick={saveToMine} disabled={saving}>
                {saving ? "Salvando..." : "💾 Salvar como meu template"}
              </button>
              <button className="btn btn-outline !py-2 !px-4 text-xs" onClick={() => setValues(defaultValues(template.structure))}>
                ↺ Resetar
              </button>
            </div>

            <p className="text-[0.7rem] text-gray-400 leading-relaxed">
              💡 Dica: para exportar, você pode usar a prévia como referência de layout e o botão <strong>Copiar
              conteúdo</strong> para colar o texto no seu aplicativo de design favorito (Canva, Instagram, CapCut).
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <button className="btn btn-outline" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </div>
  );
}

export function AiTemplatesPanel({ templates, userTemplates, onSavedTemplate }: Props) {
  const [editing, setEditing] = useState<{ template: AiTemplate; initial: Record<string, string> } | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [showMine, setShowMine] = useState(false);

  if (!templates || templates.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title mb-1">Templates prontos</h2>
        <p className="text-sm text-gray-500">Nenhum template disponível no momento.</p>
      </div>
    );
  }

  const categories = Array.from(new Set(templates.map((t) => t.category)));

  const visibleTemplates = templates.filter((t) => category === "all" || t.category === category);

  const openEditor = (template: AiTemplate, initial?: Record<string, string>) => {
    setEditing({ template, initial: initial || defaultValues(template.structure) });
  };

  const duplicateGlobal = (template: AiTemplate) => {
    const values = defaultValues(template.structure);
    setEditing({ template, initial: values });
  };

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
        <h2 className="card-title mb-1">Templates prontos para redes sociais</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className={`badge !px-3 !py-1.5 cursor-pointer ${showMine ? "bg-[#1d5c3a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            onClick={() => setShowMine((v) => !v)}
          >
            {showMine ? "✓ Mostrando meus" : "Meus templates"}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Escolha um modelo visual, personalize o texto, as cores, a imagem, o logo e a posição dos elementos. A prévia
        atualiza em tempo real — depois é só copiar o conteúdo e montar no seu app de design favorito. <strong>Sem
        serviços pagos obrigatórios.</strong>
      </p>

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          className={`badge !px-3 !py-1.5 cursor-pointer ${category === "all" ? "bg-[#1d5c3a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          onClick={() => setCategory("all")}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c}
            className={`badge !px-3 !py-1.5 cursor-pointer ${category === c ? "bg-[#1d5c3a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleTemplates.map((template) => (
          <div key={template.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <TemplatePreview template={template} values={defaultValues(template.structure)} />
            <div className="mt-3">
              <p className="font-semibold text-sm">{template.emoji} {template.name}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{template.description}</p>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-primary !py-2 !px-3 !text-xs flex-1" onClick={() => openEditor(template)}>
                Editar e personalizar
              </button>
              <button className="btn btn-outline !py-2 !px-3 !text-xs" onClick={() => duplicateGlobal(template)} title="Duplicar para editar">
                ⧉
              </button>
            </div>
          </div>
        ))}
      </div>

      {showMine && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Meus templates salvos</h3>
          {userTemplates && userTemplates.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {userTemplates.map((ut) => (
                <div key={ut.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="font-semibold text-sm">{ut.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(ut.created_at).toLocaleString("pt-BR")}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      className="btn btn-outline !py-1.5 !px-3 !text-xs flex-1"
                      onClick={() => {
                        const base = templates.find((t) => t.code === ut.template_code);
                        if (base) setEditing({ template: base, initial: ut.data as Record<string, string> });
                      }}
                    >
                      Reabrir
                    </button>
                    <button
                      className="btn btn-outline !py-1.5 !px-3 !text-xs text-red-500"
                      onClick={async () => {
                        const res = await fetch(`/api/ai/user-templates/${ut.id}`, { method: "DELETE" });
                        if (res.ok) window.location.reload();
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Você ainda não salvou nenhum template personalizado.</p>
          )}
        </div>
      )}

      {editing && (
        <TemplateEditor
          template={editing.template}
          initial={editing.initial}
          onClose={() => setEditing(null)}
          onSave={async () => true}
          onSavedUserTemplate={onSavedTemplate}
        />
      )}
    </div>
  );
}