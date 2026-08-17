"use client";

import { useEffect, useMemo, useState } from "react";
import type { AiProvider, AiTool, AiTemplate, AiHistoryItem, AiUserTemplate, AiToolField } from "@/types";
import { AiConfig } from "@/components/dashboard/AiConfig";
import { AiPromptsPanel } from "@/components/dashboard/AiPromptsPanel";
import { AiTemplatesPanel } from "@/components/dashboard/AiTemplatesPanel";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/components/dashboard/AiCategories";

interface Catalog {
  tools: AiTool[];
  templates: AiTemplate[];
  history: AiHistoryItem[];
  userTemplates: AiUserTemplate[];
  favorites: string[];
  settings: { provider_id: string | null; has_key: boolean; key_hint: string | null };
  providers: AiProvider[];
}

const HOW_TO_STEPS = [
  { icon: "🧭", text: "Escolha uma ferramenta nos cards abaixo." },
  { icon: "🛍️", text: "Informe o produto ou assunto que você quer divulgar." },
  { icon: "🎨", text: "Escolha o estilo, tom e formato desejados." },
  { icon: "✨", text: "Clique em Gerar e aguarde o resultado." },
  { icon: "✏️", text: "Edite o texto até ficar do seu jeito." },
  { icon: "📋", text: "Copie e use no seu site, redes sociais ou WhatsApp." },
];

export function AiCenter({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [openTool, setOpenTool] = useState<AiTool | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  async function load() {
    const res = await fetch("/api/ai/catalog");
    const json = await res.json();
    if (res.ok) setCatalog(json);
    else setMessage({ ok: false, text: json.error || "Erro ao carregar a Central de IA." });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function setFavorites(favorites: string[]) {
    setCatalog((c) => (c ? { ...c, favorites } : c));
  }

  async function toggleFavorite(tool: AiTool) {
    const current = catalog?.favorites.includes(tool.code) || false;
    const res = await fetch("/api/ai/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_code: tool.code, favorite: !current }),
    });
    const json = await res.json();
    if (res.ok && json.favorites) setFavorites(json.favorites);
  }

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.tools.filter((t) => {
      if (activeCategory !== "all" && t.category !== activeCategory) return false;
      if (showFavoritesOnly && !catalog.favorites.includes(t.code)) return false;
      if (!q) return true;
      const hay = `${t.name} ${t.description || ""} ${t.category}`.toLowerCase();
      return hay.includes(q);
    });
  }, [catalog, query, activeCategory, showFavoritesOnly]);

  if (loading) return <p className="text-sm text-gray-400">Carregando Central de IA...</p>;
  if (!catalog) {
    return (
      <div className="card">
        <p className="text-sm text-red-600">{message?.text || "Não foi possível carregar a Central de IA."}</p>
      </div>
    );
  }

  const hasKey = catalog.settings.has_key;
  const toolsByCategory = CATEGORY_ORDER.filter((c) => catalog.tools.some((t) => t.category === c));

  return (
    <div className="space-y-6">
      {/* ---------- O que é ---------- */}
      <div className="card bg-gradient-to-br from-[#e5f4ea] to-white border-[#d5e8db]">
        <div className="flex items-start gap-4">
          <span className="text-4xl">🌿</span>
          <div>
            <h2 className="card-title mb-1">Sua central de criação de conteúdo</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Gere títulos, descrições, posts, anúncios, ideias e calendários para o universo <strong>doTERRA e óleos
              essenciais</strong>. Tudo é editável e fica salvo no seu histórico — use onde quiser: site, Instagram,
              Facebook, WhatsApp, Stories e Reels.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Conteúdo sempre <strong>comercial/educativo responsável</strong>: sem promessas de cura ou alegações
              médicas. A IA usa apenas as informações que você fornece.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <p className={`rounded-lg px-4 py-3 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{message.text}</p>
      )}

      {/* ---------- Opções de IA ---------- */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="card-title mb-1">Opções de IA</h2>
          <span className={`badge ${hasKey ? "badge-green" : "badge-yellow"}`}>
            {hasKey ? "✓ IA configurada" : "IA não configurada"}
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          As ferramentas usam sua própria <strong>IA gratuita</strong>. Você configura uma chave gratuita de um dos
          provedores abaixo (Google Gemini, Groq ou OpenRouter) e gera conteúdo sem pagar nada. A chave fica
          criptografada no servidor e <strong>nunca</strong> aparece no navegador.
        </p>
        <AiConfig
          settings={catalog.settings}
          providers={catalog.providers}
          onSaved={() => setMessage({ ok: true, text: "Configuração salva! Agora teste a conexão e use as ferramentas." })}
        />
        {!hasKey && (
          <p className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            💡 Configure sua IA gratuita acima para desbloquear a geração de conteúdo. As áreas de <strong>Prompts
            prontos</strong> e <strong>Templates</strong> funcionam mesmo sem chave.
          </p>
        )}
      </div>

      {/* ---------- Ferramentas ---------- */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="card-title">Ferramentas de criação</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="input !py-2 sm:w-64"
              placeholder="🔍 Buscar ferramenta..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className={`btn !py-2 !px-4 text-xs ${showFavoritesOnly ? "btn-primary" : "btn-outline"}`}
              onClick={() => setShowFavoritesOnly((v) => !v)}
            >
              {showFavoritesOnly ? "★ Favoritas" : "☆ Favoritas"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <button
            className={`badge !px-4 !py-2 cursor-pointer ${activeCategory === "all" ? "bg-[#1d5c3a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            onClick={() => setActiveCategory("all")}
          >
            Todas
          </button>
          {toolsByCategory.map((c) => (
            <button
              key={c}
              className={`badge !px-4 !py-2 cursor-pointer ${activeCategory === c ? "bg-[#1d5c3a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              onClick={() => setActiveCategory(c)}
            >
              {CATEGORY_LABELS[c] || c}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">Nenhuma ferramenta encontrada para essa busca.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((tool) => {
              const isFav = catalog.favorites.includes(tool.code);
              const needsKey = tool.generates_content && !hasKey;
              return (
                <div key={tool.id} className="rounded-xl border border-gray-100 bg-gray-50 hover:border-[#1d5c3a] hover:shadow-sm transition-all p-4 flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-3xl">{tool.emoji}</span>
                    <button
                      onClick={() => toggleFavorite(tool)}
                      className={`text-lg transition-colors ${isFav ? "text-amber-400" : "text-gray-300 hover:text-amber-400"}`}
                      title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      {isFav ? "★" : "☆"}
                    </button>
                  </div>
                  <h3 className="font-semibold text-sm">{tool.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 flex-1 leading-relaxed">{tool.description}</p>

                  {tool.examples && tool.examples.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {tool.examples.slice(0, 2).map((ex, i) => (
                        <p key={i} className="text-[0.7rem] text-gray-400 italic">“{ex}”</p>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`badge ${tool.generates_content ? "badge-green" : "badge-blue"}`}>
                        {tool.generates_content ? "IA gratuita" : "Sem chave"}
                      </span>
                      {isFav && <span className="badge badge-yellow">Favorita</span>}
                    </div>
                    <button className="btn btn-primary !py-2 !px-4 text-xs" onClick={() => setOpenTool(tool)}>
                      Usar ferramenta
                    </button>
                  </div>

                  {needsKey && (
                    <p className="mt-2 text-[0.7rem] text-amber-700 bg-amber-50 rounded px-2 py-1">
                      Configure sua IA gratuita acima para usar.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button className="btn btn-outline !py-3 justify-start" onClick={() => { setShowPrompts(true); setShowTemplates(false); }}>
            🧩 <span className="text-left"><strong>Prompts prontos</strong><br /><span className="text-xs font-normal text-gray-500">Copie e use em qualquer IA gratuita (ChatGPT, Gemini, Copilot...)</span></span>
          </button>
          <button className="btn btn-outline !py-3 justify-start" onClick={() => { setShowTemplates(true); setShowPrompts(false); }}>
            🎨 <span className="text-left"><strong>Templates prontos</strong><br /><span className="text-xs font-normal text-gray-500">Modelos visuais editáveis para suas redes sociais</span></span>
          </button>
        </div>
      </div>

      {/* ---------- Modal da ferramenta ---------- */}
      {openTool && (
        <AiToolModal
          tool={openTool}
          hasKey={hasKey}
          providers={catalog.providers}
          onClose={() => setOpenTool(null)}
          onSaved={(item) =>
            setCatalog((c) => (c ? { ...c, history: [item, ...c.history].slice(0, 50) } : c))
          }
          onError={(text) => setMessage(text ? { ok: false, text } : null)}
        />
      )}

      {/* ---------- Como usar a IA gratuitamente ---------- */}
      <div className="card">
        <h2 className="card-title mb-3">Como usar a IA gratuitamente?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {HOW_TO_STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <span className="text-2xl shrink-0">{s.icon}</span>
              <div>
                <span className="badge badge-green mb-1">Passo {i + 1}</span>
                <p className="text-sm text-gray-600 mt-1">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
        {!hasKey && (
          <p className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Antes de começar, configure sua chave gratuita na área <strong>“Opções de IA”</strong> acima — basta criar
            uma conta no provedor (Google Gemini, Groq ou OpenRouter), pegar a API Key e colá-la aqui. Leva menos de 2
            minutos.
          </p>
        )}
        {isSuperAdmin && (
          <p className="mt-3 text-xs text-gray-400">
            Dica: como Super Admin você pode controlar provedores em /admin/editor-ia e as ferramentas, templates e
            estatísticas da Central de IA em /admin/ia.
          </p>
        )}
      </div>

      {/* ---------- Prompts prontos ---------- */}
      {showPrompts && <AiPromptsPanel />}

      {/* ---------- Templates ---------- */}
      {showTemplates && (
        <AiTemplatesPanel
          templates={catalog.templates}
          userTemplates={catalog.userTemplates}
          onSavedTemplate={(t) =>
            setCatalog((c) => (c ? { ...c, userTemplates: [t, ...c.userTemplates] } : c))
          }
        />
      )}

      {/* ---------- Histórico ---------- */}
      <AiHistoryPanel
        history={catalog.history}
        onDelete={(id) =>
          setCatalog((c) => (c ? { ...c, history: c.history.filter((h) => h.id !== id) } : c))
        }
        onToggleFavorite={(id, fav) =>
          setCatalog((c) =>
            c ? { ...c, history: c.history.map((h) => (h.id === id ? { ...h, favorite: fav } : h)) } : c
          )
        }
      />
    </div>
  );
}

/* ============================================================================
 * Modal de ferramenta: formulário dinâmico + geração + resultado
 * ========================================================================== */

function AiToolModal({
  tool,
  hasKey,
  providers,
  onClose,
  onSaved,
  onError,
}: {
  tool: AiTool;
  hasKey: boolean;
  providers: AiProvider[];
  onClose: () => void;
  onSaved: (item: AiHistoryItem) => void;
  onError: (text: string) => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of tool.fields) {
      if (f.type === "number") init[f.key] = f.min ? String(f.min) : "";
      else if (f.type === "select" && f.options?.[0]) init[f.key] = f.options[0];
      else init[f.key] = "";
    }
    return init;
  });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ text: string; historyId: string | null } | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  function setField(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function generate() {
    if (!hasKey) {
      onError("Configure sua IA gratuita na área 'Opções de IA' antes de gerar conteúdo.");
      return;
    }
    const requiredMissing = tool.fields.filter((f) => f.required && !String(fields[f.key] || "").trim());
    if (requiredMissing.length > 0) {
      onError(`Preencha os campos obrigatórios: ${requiredMissing.map((f) => f.label).join(", ")}.`);
      return;
    }
    setGenerating(true);
    setResult(null);
    onError("");
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: tool.code, fields }),
    });
    const json = await res.json();
    setGenerating(false);
    if (!res.ok) {
      onError(json.error || "Erro ao gerar conteúdo.");
      return;
    }
    const text = json.text || "";
    setResult({ text, historyId: json.history_id || null });
    setDraft(text);
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      onError("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  const renderField = (f: AiToolField) => {
    const value = fields[f.key] ?? "";
    if (f.type === "textarea") {
      return (
        <div key={f.key}>
          <label className="label">
            {f.label} {f.required && <span className="text-red-500">*</span>}
          </label>
          <textarea
            className="input min-h-20"
            placeholder={f.placeholder}
            value={value}
            onChange={(e) => setField(f.key, e.target.value)}
          />
        </div>
      );
    }
    if (f.type === "select") {
      return (
        <div key={f.key}>
          <label className="label">
            {f.label} {f.required && <span className="text-red-500">*</span>}
          </label>
          <select className="input" value={value} onChange={(e) => setField(f.key, e.target.value)}>
            {f.options?.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div key={f.key}>
        <label className="label">
          {f.label} {f.required && <span className="text-red-500">*</span>}
        </label>
        <input
          type={f.type === "number" ? "number" : "text"}
          className="input"
          placeholder={f.placeholder}
          min={f.min}
          max={f.max}
          value={value}
          onChange={(e) => setField(f.key, e.target.value)}
        />
        {f.hint && <p className="text-[0.7rem] text-gray-400 mt-1">{f.hint}</p>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-3xl my-8">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{tool.emoji}</span>
            <div>
              <h3 className="card-title">{tool.name}</h3>
              <p className="text-xs text-gray-500 max-w-xl">{tool.description}</p>
            </div>
          </div>
          <button className="text-gray-400 text-xl" onClick={onClose}>✕</button>
        </div>

        {!hasKey && (
          <p className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            ⚠️ Esta ferramenta usa IA. Configure sua chave gratuita na área <strong>“Opções de IA”</strong> acima
            (provedores disponíveis: {providers.map((p) => p.name).join(", ")}).
          </p>
        )}

        {!result ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {tool.fields.map(renderField)}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={generate} disabled={generating || !hasKey}>
                {generating ? "Gerando..." : "✨ Gerar conteúdo"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">Resultado — edite livremente</p>
                <div className="flex gap-2">
                  <button className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={copyResult}>
                    {copied ? "✓ Copiado!" : "📋 Copiar"}
                  </button>
                  <button className="btn btn-primary !py-1.5 !px-3 !text-xs" onClick={generate} disabled={generating}>
                    {generating ? "Gerando..." : "↻ Regenerar"}
                  </button>
                </div>
              </div>
              <textarea className="input min-h-60 font-mono text-xs leading-relaxed" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <p className="text-xs text-gray-400 mt-2">
                💾 O conteúdo foi salvo automaticamente no seu histórico (área “Histórico recente” no fim da página).
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button className="btn btn-outline" onClick={onClose}>Concluir</button>
              <button className="btn btn-primary" onClick={copyResult}>{copied ? "✓ Copiado!" : "📋 Copiar e usar"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * Histórico
 * ========================================================================== */

function AiHistoryPanel({
  history,
  onDelete,
  onToggleFavorite,
}: {
  history: AiHistoryItem[];
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, fav: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editedId, setEditedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!history || history.length === 0) return null;

  async function toggleFav(item: AiHistoryItem) {
    const res = await fetch(`/api/ai/history/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !item.favorite }),
    });
    if (res.ok) onToggleFavorite(item.id, !item.favorite);
  }

  async function remove(item: AiHistoryItem) {
    const res = await fetch(`/api/ai/history/${item.id}`, { method: "DELETE" });
    if (res.ok) onDelete(item.id);
  }

  async function copyText(item: AiHistoryItem, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(item.id);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* noop */
    }
  }

  function startEdit(item: AiHistoryItem) {
    setEditedId(item.id);
    setDraft(item.content);
  }

  const visible = history.slice(0, 12);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="card-title mb-1">Histórico recente</h2>
        <span className="badge badge-gray">{history.length} conteúdo(s)</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Seus conteúdos gerados ficam salvos aqui, separados por usuário. Reutilize, edite, copie, regenere ou exclua
        quando quiser.
      </p>

      <div className="space-y-2">
        {visible.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg">{item.tool_name ? "" : "🤖"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {item.tool_name || "Conteúdo"}
                  </p>
                  <p className="text-[0.7rem] text-gray-400">
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                    {item.favorite && " · ★ favorito"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleFav(item)}
                  className={`text-lg ${item.favorite ? "text-amber-400" : "text-gray-300 hover:text-amber-400"}`}
                  title={item.favorite ? "Remover favorito" : "Favoritar"}
                >
                  {item.favorite ? "★" : "☆"}
                </button>
                <button className="btn btn-outline !py-1 !px-2 !text-xs" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                  {expanded === item.id ? "Ocultar" : "Ver"}
                </button>
                <button className="btn btn-outline !py-1 !px-2 !text-xs" onClick={() => startEdit(item)}>Editar</button>
                <button className="btn btn-outline !py-1 !px-2 !text-xs" onClick={() => copyText(item, item.content)}>
                  {copied === item.id ? "✓" : "📋"}
                </button>
                <button className="btn btn-outline !py-1 !px-2 !text-xs text-red-500" onClick={() => remove(item)}>🗑</button>
              </div>
            </div>

            {expanded === item.id && (
              <div className="mt-3">
                {editedId === item.id ? (
                  <>
                    <textarea className="input min-h-40 font-mono text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} />
                    <div className="flex justify-end gap-2 mt-2">
                      <button className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => setEditedId(null)}>Cancelar</button>
                      <button className="btn btn-primary !py-1.5 !px-3 !text-xs" onClick={() => copyText(item, draft)}>Copiar editado</button>
                    </div>
                  </>
                ) : (
                  <pre className="text-xs whitespace-pre-wrap text-gray-700 bg-white rounded-lg p-3 border border-gray-100 max-h-64 overflow-y-auto">{item.content}</pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {history.length > 12 && (
        <p className="mt-3 text-xs text-gray-400">Mostrando os 12 mais recentes de {history.length}.</p>
      )}
    </div>
  );
}