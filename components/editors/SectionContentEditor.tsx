"use client";

import { useMemo, useState } from "react";
import type { SectionType } from "@/types";
import { SECTION_CONTENT_FIELDS, jsonToString, stringToJson, type ContentFieldDef } from "@/lib/section-fields";
import { deepMerge } from "@/lib/home";
import { MediaPicker } from "@/components/media/MediaPicker";

interface SectionContentEditorProps {
  sectionType: SectionType;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** Escopo de mídia: "system" (Super Admin/global) ou "tenant" (padrão). */
  mediaScope?: "tenant" | "system";
  /** Esconde o botão da biblioteca (usado na demonstração local). */
  disableLibrary?: boolean;
}

interface Suggestion {
  field: string;
  text: string;
  loading?: boolean;
  error?: string;
}

function setPath(obj: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  const out = { ...obj };
  let cur = out;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const existing = cur[key];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      cur[key] = { ...(existing as Record<string, unknown>) };
    } else {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  const last = path[path.length - 1];
  if (value === undefined) {
    delete cur[last];
  } else {
    cur[last] = value;
  }
  return out;
}

function getPath(obj: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

const AI_KIND_PROMPTS: Record<string, string> = {
  title: "Crie um título curto e elegante (máx. 6 palavras) para uma seção de site de bem-estar e óleos essenciais.",
  description: "Escreva uma descrição convincente (2 a 3 frases) com tom elegante e profissional.",
  post: "Escreva um texto curto e acolhedor em português do Brasil para conteúdo de bem-estar.",
  faq: "Gere uma pergunta comum (FAQ) sobre bem-estar e óleos essenciais.",
  default: "Escreva um texto claro e elegante em português do Brasil.",
};

export function SectionContentEditor({ sectionType, value, onChange, mediaScope, disableLibrary }: SectionContentEditorProps) {
  const fields = useMemo(() => SECTION_CONTENT_FIELDS[sectionType] || [], [sectionType]);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});

  async function generate(field: ContentFieldDef, path: string[]) {
    const kind = field.aiKind || "default";
    const key = path.join(".");
    setSuggestions((prev) => ({ ...prev, [key]: { field: key, text: "", loading: true } }));
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, prompt: AI_KIND_PROMPTS[kind] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar conteúdo");
      setSuggestions((prev) => ({ ...prev, [key]: { field: key, text: data.text } }));
    } catch (e) {
      setSuggestions((prev) => ({
        ...prev,
        [key]: { field: key, text: "", error: e instanceof Error ? e.message : "Erro ao gerar conteúdo" },
      }));
    }
  }

  function applySuggestion(path: string[]) {
    const key = path.join(".");
    const s = suggestions[key];
    if (!s || !s.text) return;
    onChange(setPath(value, path, s.text));
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function renderField(field: ContentFieldDef, path: string[], indent = 0) {
    const current = getPath(value, path);
    const fieldKey = path.join(".");
    const suggestion = suggestions[fieldKey];

    const label = (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: indent > 0 ? 8 : 0 }}>
        <label className="label" style={{ marginBottom: 4 }}>{field.label}</label>
        {field.ai && (
          <button type="button" className="btn btn-outline !py-1 !px-2 !text-[0.7rem]" onClick={() => generate(field, path)} disabled={suggestion?.loading}>
            {suggestion?.loading ? "Gerando..." : "✨ Gerar com IA"}
          </button>
        )}
      </div>
    );

    const box: React.ReactNode = (() => {
      switch (field.type) {
        case "textarea":
          return (
            <textarea
              className="input min-h-20"
              value={typeof current === "string" ? current : ""}
              placeholder={field.placeholder}
              onChange={(e) => onChange(setPath(value, path, e.target.value))}
            />
          );
        case "url":
        case "text":
          return (
            <input
              type="text"
              className="input"
              value={typeof current === "string" ? current : ""}
              placeholder={field.placeholder}
              onChange={(e) => onChange(setPath(value, path, e.target.value))}
            />
          );
        case "image":
          return (
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  value={typeof current === "string" ? current : ""}
                  placeholder={disableLibrary ? "URL da imagem" : "URL da imagem ou escolha na biblioteca"}
                  onChange={(e) => onChange(setPath(value, path, e.target.value))}
                />
                {!disableLibrary && (
                  <MediaPicker
                    scope={mediaScope || "tenant"}
                    value={typeof current === "string" ? current : ""}
                    onChange={(url) => onChange(setPath(value, path, url))}
                  />
                )}
              </div>
              {typeof current === "string" && current && (
                <div className="mt-2 rounded-lg bg-gray-50 p-2 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current}
                    alt="preview"
                    className="h-20 w-auto max-w-full object-contain rounded"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>
          );
        case "boolean":
          return (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
              <input type="checkbox" checked={Boolean(current)} onChange={(e) => onChange(setPath(value, path, e.target.checked))} />
              Ativo
            </label>
          );
        case "json":
          return (
            <input
              type="text"
              className="input"
              value={jsonToString(current)}
              placeholder="JSON"
              onChange={(e) => onChange(setPath(value, path, stringToJson(e.target.value)))}
            />
          );
        case "object":
          return (
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
              {(field.fields || []).map((sub) => renderField(sub, [...path, sub.key], 1))}
            </div>
          );
        case "list": {
          const list = Array.isArray(current) ? (current as unknown[]) : [];
          return (
            <div className="space-y-2">
              {list.map((item, idx) => (
                <div key={idx} className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500">{field.itemLabel || "Item"} {idx + 1}</span>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => onChange(setPath(value, path, list.filter((_, i) => i !== idx)))}
                    >
                      Remover
                    </button>
                  </div>
                  {field.fields?.length ? (
                    (field.fields || []).map((sub) => {
                      const itemObj = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
                      const subValue = getPath(itemObj, [sub.key]);
                      return renderListItem(sub, subValue, (next) => {
                        const updated = [...list];
                        updated[idx] = { ...itemObj, ...next };
                        onChange(setPath(value, path, updated));
                      });
                    })
                  ) : (
                    <input
                      className="input"
                      value={typeof item === "string" ? item : JSON.stringify(item)}
                      onChange={(e) => {
                        const updated = [...list];
                        updated[idx] = e.target.value;
                        onChange(setPath(value, path, updated));
                      }}
                    />
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => onChange(setPath(value, path, [...list, {}]))}>
                + Adicionar {field.itemLabel || "item"}
              </button>
            </div>
          );
        }
        default:
          return null;
      }
    })();

    return (
      <div key={fieldKey} style={{ marginBottom: 10 }}>
        {label}
        {box}
        {suggestion && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            {suggestion.error ? (
              <p className="text-xs text-red-600">{suggestion.error}</p>
            ) : (
              <>
                <p className="text-xs font-semibold text-amber-800 mb-1">Sugestão gerada por IA</p>
                <textarea className="input min-h-16" value={suggestion.text} onChange={(e) => setSuggestions((prev) => ({ ...prev, [fieldKey]: { ...suggestion, text: e.target.value } }))} />
                <div className="flex gap-2 mt-2">
                  <button type="button" className="btn btn-primary !py-1 !px-3 !text-xs" onClick={() => applySuggestion(path)}>
                    Aceitar sugestão
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline !py-1 !px-3 !text-xs"
                    onClick={() =>
                      setSuggestions((prev) => {
                        const next = { ...prev };
                        delete next[fieldKey];
                        return next;
                      })
                    }
                  >
                    Descartar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderListItem(field: ContentFieldDef, current: unknown, onChangeItem: (next: Record<string, unknown>) => void) {
    switch (field.type) {
      case "textarea":
        return (
          <div key={field.key} className="mb-2">
            <label className="label">{field.label}</label>
            <textarea className="input min-h-14" value={typeof current === "string" ? current : ""} onChange={(e) => onChangeItem({ [field.key]: e.target.value })} />
          </div>
        );
      case "boolean":
        return (
          <div key={field.key} className="mb-2">
            <label className="label">{field.label}</label>
            <input type="checkbox" checked={Boolean(current)} onChange={(e) => onChangeItem({ [field.key]: e.target.checked })} />
          </div>
        );
      case "list": {
        const list = Array.isArray(current) ? (current as unknown[]) : [];
        return (
          <div key={field.key} className="mb-2">
            <label className="label">{field.label}</label>
            {list.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1">
                <input className="input flex-1" value={typeof item === "string" ? item : ""} onChange={(e) => {
                  const updated = [...list];
                  updated[idx] = e.target.value;
                  onChangeItem({ [field.key]: updated });
                }} />
                <button type="button" className="text-xs text-red-600" onClick={() => onChangeItem({ [field.key]: list.filter((_, i) => i !== idx) })}>✕</button>
              </div>
            ))}
            <button type="button" className="text-xs text-[#1d5c3a] underline" onClick={() => onChangeItem({ [field.key]: [...list, ""] })}>
              + Adicionar
            </button>
          </div>
        );
      }
      case "json":
        return (
          <div key={field.key} className="mb-2">
            <label className="label">{field.label}</label>
            <input className="input" value={jsonToString(current)} onChange={(e) => onChangeItem({ [field.key]: stringToJson(e.target.value) })} />
          </div>
        );
      default:
        return (
          <div key={field.key} className="mb-2">
            <label className="label">{field.label}</label>
            <input className="input" value={typeof current === "string" ? current : ""} onChange={(e) => onChangeItem({ [field.key]: e.target.value })} />
          </div>
        );
    }
  }

  if (fields.length === 0) {
    return (
      <div>
        <label className="label">Conteúdo (JSON)</label>
        <textarea
          className="input min-h-48 font-mono !text-xs"
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              onChange(deepMerge({}, JSON.parse(e.target.value)));
            } catch {
              // JSON inválido — não aplica até ficar válido
            }
          }}
        />
      </div>
    );
  }

  return <div>{fields.map((f) => renderField(f, [f.key]))}</div>;
}
