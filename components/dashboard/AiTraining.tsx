"use client";

import { useEffect, useState } from "react";
import type { IaTrainingEntry } from "@/lib/ia-knowledge";

interface Draft {
  keywords: string;
  text: string;
  oils: string;
}

const EMPTY: Draft = { keywords: "", text: "", oils: "" };

function toDraft(e: IaTrainingEntry): Draft {
  return {
    keywords: e.keywords || "",
    text: e.text || "",
    oils: (e.oils || []).join(", "),
  };
}

function toEntry(d: Draft): IaTrainingEntry {
  return {
    keywords: d.keywords.trim(),
    text: d.text.trim(),
    oils: d.oils
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o),
  };
}

/**
 * Painel de treinamento da "Especialista IA doTERRA".
 * Permite cadastrar perguntas pré-prontas com respostas pré-prontas, que a
 * assistente usa com prioridade (antes da base padrão e da IA).
 */
export function AiTraining() {
  const [entries, setEntries] = useState<Draft[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/ia/training");
      const json = await res.json();
      if (res.ok) {
        setEntries((json.knowledge || []).map(toDraft));
        setCanEdit(json.can_edit !== false);
      } else {
        setMessage({ ok: false, text: json.error || "Erro ao carregar o treinamento." });
      }
    } catch {
      setMessage({ ok: false, text: "Erro de conexão ao carregar o treinamento." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setEditing(-1);
    setDraft(EMPTY);
  }

  function startEdit(i: number) {
    setEditing(i);
    setDraft(entries[i]);
  }

  function saveDraft() {
    if (!draft.keywords.trim() || !draft.text.trim()) {
      setMessage({ ok: false, text: "Preencha a pergunta e a resposta." });
      return;
    }
    const updated = [...entries];
    if (editing === -1) {
      updated.push(draft);
    } else if (editing !== null) {
      updated[editing] = draft;
    }
    setEntries(updated);
    setEditing(null);
    setDraft(EMPTY);
    setMessage(null);
  }

  function remove(i: number) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
    if (editing === i) {
      setEditing(null);
      setDraft(EMPTY);
    }
  }

  async function saveAll() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ia/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge: entries.map(toEntry) }),
      });
      const json = await res.json();
      if (res.ok) {
        setEntries((json.knowledge || []).map(toDraft));
        setMessage({ ok: true, text: "Treinamento salvo! A assistente já usa suas respostas." });
      } else {
        setMessage({ ok: false, text: json.error || "Erro ao salvar o treinamento." });
      }
    } catch {
      setMessage({ ok: false, text: "Erro de conexão ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Carregando treinamento...</p>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`card p-4 text-sm ${message.ok ? "text-green-600" : "text-red-500"}`}>
          {message.text}
        </div>
      )}

      {!canEdit && (
        <div className="card p-4 text-sm text-amber-600">
          O Super Admin bloqueou a edição desta seção no seu site. O treinamento está disponível apenas para leitura.
        </div>
      )}

      <div className="card p-5">
        <h3 className="font-semibold mb-1">Como funciona</h3>
        <p className="text-sm text-gray-500">
          Cadastre <strong>perguntas pré-prontas</strong> com <strong>respostas pré-prontas</strong>. Quando um visitante
          escrever algo que corresponda, a assistente responde com o seu texto — sempre com prioridade sobre a base padrão
          e a IA. Isso garante que suas respostas estejam sempre no controle e no tom do seu atendimento.
        </p>
        <ul className="mt-3 text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Em <strong>Pergunta</strong>, use as palavras-chave que o visitante provavelmente digitará (separadas por vírgula).</li>
          <li>Em <strong>Resposta</strong>, escreva o texto pronto que a assistente deve enviar.</li>
          <li>Em <strong>Óleos sugeridos</strong>, liste os óleos doTERRA indicados (opcional, um por linha).</li>
        </ul>
      </div>

      {canEdit && (
        <div className="flex items-center justify-between">
          <button className="btn btn-primary !py-2 !px-4 text-xs" onClick={startNew} disabled={editing !== null}>
            + Nova pergunta/resposta
          </button>
          <button className="btn btn-gold !py-2 !px-4 text-xs" onClick={saveAll} disabled={saving || entries.length === 0}>
            {saving ? "Salvando..." : "💾 Salvar treinamento"}
          </button>
        </div>
      )}

      {editing !== null && canEdit && (
        <div className="card p-5">
          <h3 className="font-semibold mb-4">{editing === -1 ? "Nova pergunta/resposta" : "Editar pergunta/resposta"}</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Pergunta (palavras-chave, separadas por vírgula)</label>
              <input
                className="input"
                value={draft.keywords}
                onChange={(e) => setDraft((d) => ({ ...d, keywords: e.target.value }))}
                placeholder="Ex.: ansiedade, estresse, calma, preocupação"
              />
            </div>
            <div>
              <label className="label">Resposta pronta do assistente</label>
              <textarea
                className="input min-h-24"
                value={draft.text}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                placeholder="Ex.: Para aliviar a ansiedade, recomendo difundir ou aplicar nos pulsos:"
              />
            </div>
            <div>
              <label className="label">Óleos sugeridos (opcional, separados por vírgula)</label>
              <input
                className="input"
                value={draft.oils}
                onChange={(e) => setDraft((d) => ({ ...d, oils: e.target.value }))}
                placeholder="Ex.: Lavender, Serenity, Balance"
              />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary !py-2 !px-4 text-xs" onClick={saveDraft}>
                {editing === -1 ? "Adicionar" : "Atualizar"}
              </button>
              <button className="btn btn-outline !py-2 !px-4 text-xs" onClick={() => { setEditing(null); setDraft(EMPTY); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="card p-6 text-center text-sm text-gray-400">
          Nenhuma pergunta cadastrada ainda. Clique em <strong>+ Nova pergunta/resposta</strong> para começar.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">❓ {e.keywords || "(sem pergunta)"}</p>
                  <p className="text-sm text-gray-600 mt-1">💬 {e.text || "(sem resposta)"}</p>
                  {e.oils && (
                    <p className="text-xs text-gray-400 mt-1">
                      🫙 Óleos: {e.oils}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-2 shrink-0">
                    <button className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => startEdit(i)}>
                      Editar
                    </button>
                    <button className="btn btn-outline !py-1.5 !px-3 !text-xs text-red-500" onClick={() => remove(i)}>
                      🗑
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}