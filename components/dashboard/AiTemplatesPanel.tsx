"use client";

import { useEffect, useState } from "react";
import type { AiTemplate, AiUserTemplate, AiTemplateField } from "@/types";

// Pool de imagens profissionais doTERRA / óleos essenciais — 100% gratuitas (Unsplash, licença livre)
// Todas já vêm como default nos templates, mas servem também como fallback e para novas sugestões.
const DOTERRA_IMAGES = [
  "https://images.unsplash.com/photo-1608571423902-eed4a94d8108?w=800&auto=format&fit=crop&q=80", // frascos âmbar
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&auto=format&fit=crop&q=80", // lavanda campo
  "https://images.unsplash.com/photo-1470259078422-06e8c24ebf84?w=800&auto=format&fit=crop&q=80", // ervas
  "https://images.unsplash.com/photo-1598440947619-cc6db50d67f9?w=800&auto=format&fit=crop&q=80", // citrus
  "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=800&auto=format&fit=crop&q=80", // eucalipto/folhas
  "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80", // spa / bem-estar
];

const DOTERRA_SUGGESTIONS: Array<{ title: string; subtitle: string; body: string; cta: string; hashtags: string; emoji: string; name: string }> = [
  { name: "Ritual da manhã", emoji: "🌅", title: "Ritual da manhã", subtitle: "Peppermint", body: "Comece o dia com frescor e foco — uma gota faz toda diferença na sua manhã.", cta: "Quero sentir", hashtags: "#peppermint #bomdia #doterra #oleosessenciais" },
  { name: "Noite tranquila", emoji: "🌙", title: "Noite tranquila", subtitle: "Lavender", body: "Desacelere à noite com um aroma que convida ao descanso e ao aconchego.", cta: "Quero relaxar", hashtags: "#lavender #noitetranquila #doterra" },
  { name: "Casa que acolhe", emoji: "🏡", title: "Casa que acolhe", subtitle: "On Guard®", body: "Aroma que traz sensação de cuidado e proteção para toda a família.", cta: "Conhecer", hashtags: "#onguard #familia #doterra" },
  { name: "Respira fundo", emoji: "🌿", title: "Respire fundo", subtitle: "Breathe", body: "Inspire calma, expire leveza — para momentos que pedem respiro.", cta: "Quero respirar", hashtags: "#breathe #bemestar #doterra" },
  { name: "Foco total", emoji: "🎯", title: "Foco total", subtitle: "Focus Blend", body: "Para aqueles momentos que pedem concentração e clareza.", cta: "Manter o foco", hashtags: "#foco #produtividade #doterra" },
  { name: "Bem-estar diário", emoji: "✨", title: "Bem-estar diário", subtitle: "Frankincense", body: "O toque ancestral que acompanha seu ritual de autocuidado.", cta: "Descobrir", hashtags: "#frankincense #autocuidado #doterra" },
  { name: "Energia cítrica", emoji: "🍋", title: "Energia cítrica", subtitle: "Wild Orange", body: "Um toque cítrico que desperta alegria e energia para o dia.", cta: "Quero energia", hashtags: "#wildorange #citrico #doterra" },
  { name: "Momento spa", emoji: "💆", title: "Momento spa em casa", subtitle: "AromaTerapi", body: "Transforme seu banho em um ritual de bem-estar.", cta: "Criar meu ritual", hashtags: "#spaemcasa #doterra #oleosessenciais" },
];

function getFallbackImage(templateCode: string): string {
  let hash = 0;
  for (let i = 0; i < templateCode.length; i++) hash = (hash * 31 + templateCode.charCodeAt(i)) % DOTERRA_IMAGES.length;
  return DOTERRA_IMAGES[hash];
}

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

/** Renderiza a prévia visual do template com fundos profissionais doTERRA. */
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
  // Usa imagem profissional do template ou fallback doTERRA — nunca fica só cor chapada
  const effectiveImage = values.image?.trim() ? values.image : getFallbackImage(template.code);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm ${isCarrossel ? "aspect-[4/5]" : "aspect-[9/16]"} w-full`}
      style={{ background: bg, color: text }}
    >
      {/* Fundo profissional doTERRA */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={effectiveImage} alt="" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
      {/* Overlay gradiente profissional para legibilidade + identidade */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${bg}00 10%, ${bg}CC 55%, ${bg} 92%)` }} />
      <div className="absolute inset-0 bg-black/15" />
      {/* Conteúdo */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center gap-2" style={{ justifyContent: align, paddingTop: align === "flex-start" ? 28 : undefined, paddingBottom: align === "flex-end" ? 28 : undefined }}>
        {values.logo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={values.logo} alt="Logo" className="h-8 w-auto object-contain max-w-[70%] drop-shadow-md" referrerPolicy="no-referrer" />
        )}
        {values.title && (
          <p className="text-[0.65rem] uppercase tracking-[0.2em] font-semibold drop-shadow" style={{ color: accent }}>
            {values.title}
          </p>
        )}
        {values.subtitle && (
          <h3 className="text-xl font-bold leading-tight drop-shadow" style={{ fontFamily: "var(--font-display)" }}>{values.subtitle}</h3>
        )}
        {values.body && <p className="text-[0.72rem] leading-relaxed max-w-[92%] whitespace-pre-line drop-shadow-sm bg-black/10 backdrop-blur-[1px] rounded-lg px-2 py-1">{values.body}</p>}
        {values.cta && (
          <span className="mt-1 rounded-full px-4 py-1.5 text-[0.65rem] font-bold shadow" style={{ background: accent, color: bg }}>
            {values.cta}
          </span>
        )}
        {values.hashtags && (
          <p className="text-[0.55rem] mt-1 drop-shadow bg-black/20 rounded-full px-2 py-0.5">{values.hashtags}</p>
        )}
      </div>
      <div className="absolute top-3 left-3 text-[0.6rem] px-2 py-0.5 rounded-full bg-black/35 backdrop-blur text-white/90 border border-white/10">
        {template.emoji} {template.name}
      </div>
      <div className="absolute bottom-2 right-2 text-[0.5rem] px-1.5 py-0.5 rounded bg-white/85 text-slate-700 font-medium">foto doTERRA grátis</div>
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
          <label className="label">{f.label} — <span className="text-emerald-600 font-normal">fundo profissional doTERRA já incluso (troque se quiser)</span></label>
          <input
            className="input"
            placeholder="Cole outra URL ou mantenha o fundo doTERRA gratuito"
            value={value}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
          <div className="mt-1.5 flex gap-1.5 flex-wrap">
            {DOTERRA_IMAGES.slice(0, 4).map((url) => (
              <button key={url} type="button" onClick={() => setValues((v) => ({ ...v, [f.key]: url }))} className={`h-10 w-14 rounded-lg overflow-hidden border-2 ${value === url ? "border-[#1d5c3a]" : "border-gray-200"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
            <button type="button" onClick={() => setValues((v) => ({ ...v, [f.key]: "" }))} className="h-10 px-2 rounded-lg border border-gray-200 text-xs text-gray-600 bg-white">Usar padrão</button>
          </div>
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
            <p className="text-xs text-gray-500 mt-0.5">Edite texto, cores, imagem, logo e posição. A prévia já vem com fundo profissional doTERRA — troque se quiser.</p>
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
              Todos os fundos são <b>profissionais e gratuitos</b>, inspirados em óleos essenciais doTERRA. Use a prévia como referência e copie o texto para seu app favorito (Canva, Instagram, CapCut) — sem pagar por banco de imagens.
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
  const [suggestions, setSuggestions] = useState<Array<{ key: string; tpl: AiTemplate; values: Record<string, string> }>>([]);

  const genSuggestions = () => {
    const shuffled = [...DOTERRA_SUGGESTIONS].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, 3);
    const baseTemplates = templates.length ? templates : [];
    const next = picked.map((s, i) => {
      const base = baseTemplates[i % baseTemplates.length] || baseTemplates[0];
      const tpl: AiTemplate = base ? { ...base, id: `sug-${Date.now()}-${i}`, code: `sug-${Date.now()}-${i}`, name: s.name, emoji: s.emoji, description: s.body.slice(0, 60) + "…" } : ({ id: `sug-${i}`, code: `sug-${i}`, name: s.name, emoji: s.emoji, category: "redes", description: s.body, structure: { layout: "story", fields: [] }, enabled: true, sort_order: i } as unknown as AiTemplate);
      const values: Record<string, string> = {
        title: s.title,
        subtitle: s.subtitle,
        body: s.body,
        cta: s.cta,
        hashtags: s.hashtags,
        bgColor: ["#1d5c3a", "#2d7a4f", "#8b6b45"][i % 3],
        textColor: "#ffffff",
        accentColor: ["#c4963a", "#e8c87a", "#f7f2ea"][i % 3],
        image: DOTERRA_IMAGES[(Math.floor(Math.random() * DOTERRA_IMAGES.length))],
        logo: "",
        position: "center",
      };
      return { key: `${s.name}-${Date.now()}-${i}`, tpl, values };
    });
    setSuggestions(next);
  };

  useEffect(() => {
    genSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates.length]);

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
          <button type="button" onClick={genSuggestions} className="btn btn-gold !py-2 !px-3 !text-xs">
            🔄 Renovar sugestões (grátis)
          </button>
          <button
            className={`badge !px-3 !py-1.5 cursor-pointer ${showMine ? "bg-[#1d5c3a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            onClick={() => setShowMine((v) => !v)}
          >
            {showMine ? "✓ Mostrando meus" : "Meus templates"}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-1">
        Todos os modelos já vêm com <b>fundos profissionais inspirados em óleos essenciais doTERRA</b> (frascos âmbar, lavanda, spa, ervas) — nada de cor chapada. Personalize texto, cores, logo e imagem; a prévia atualiza na hora. <strong className="text-emerald-700">100% gratuito, sem banco de imagens pago.</strong>
      </p>
      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-4">
        💡 Clique em <b>Renovar sugestões</b> quando quiser — sempre surgem <b>3 novas ideias gratuitas</b> com fundos doTERRA diferentes, prontas para Instagram, Stories e WhatsApp.
      </p>

      {suggestions.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-amber-900">✨ Sugestões do dia — gratuitas e prontas para postar</h3>
            <span className="text-[11px] font-semibold text-amber-700 bg-white border border-amber-200 rounded-full px-2 py-0.5">fundo doTERRA</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {suggestions.map(({ key, tpl, values }) => (
              <div key={key} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                <TemplatePreview template={tpl} values={values} />
                <p className="font-semibold text-sm mt-2">{tpl.emoji} {tpl.name}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{values.body}</p>
                <button className="btn btn-primary w-full !py-2 !text-xs mt-3" onClick={() => setEditing({ template: tpl, initial: values })}>
                  Usar esta sugestão
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
