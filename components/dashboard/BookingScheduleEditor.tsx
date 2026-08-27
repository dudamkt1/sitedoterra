"use client";

import { useEffect, useState } from "react";
import { BookingAgendaEditor } from "@/components/editors/BookingAgendaEditor";

interface SectionView {
  id: string;
  key: string;
  type: string;
  label: string;
  enabled: boolean;
  content: Record<string, unknown>;
}

export function BookingScheduleEditor({ onToggleSuccess }: { onToggleSuccess?: () => void }) {
  const [section, setSection] = useState<SectionView | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/sections");
      const json = await res.json();
      if (res.ok) {
        const booking = (json.sections as SectionView[]).find((s) => s.type === "booking" || s.key === "booking") || null;
        if (booking) {
          setSection(booking);
          setDraft(JSON.parse(JSON.stringify(booking.content || {})));
        }
      } else {
        setMessage({ ok: false, text: json.error || "Erro ao carregar agendamento." });
      }
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Erro ao carregar." });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggle() {
    if (!section) return;
    setToggling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", sectionId: section.id, enabled: !section.enabled }),
      });
      const json = await res.json();
      if (!res.ok) setMessage({ ok: false, text: json.error || "Erro ao alternar." });
      else {
        setMessage({ ok: true, text: !section.enabled ? "Agendamento ativado!" : "Agendamento desativado." });
        await load();
        onToggleSuccess?.();
      }
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Erro." });
    }
    setToggling(false);
  }

  async function handleSave() {
    if (!section) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", sectionId: section.id, content: draft }),
      });
      const json = await res.json();
      if (!res.ok) setMessage({ ok: false, text: json.error || "Erro ao salvar." });
      else {
        setMessage({ ok: true, text: "Agenda salva! As alterações já aparecem no seu site público." });
        await load();
      }
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    }
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando agenda...</p>;
  if (!section) return <p className="text-sm text-red-600">Seção de agendamento não encontrada.</p>;

  const isOn = section.enabled;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="card-title text-base">Seção Agendamento no site</h3>
            <p className="text-sm text-gray-500">
              {isOn ? "Ativa — aparece na sua HOME pública." : "Desativada — não aparece para visitantes."}
              <span className="ml-2 text-xs">Âncora: #agendamento</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`badge ${isOn ? "badge-green" : "badge-gray"}`}>{isOn ? "Ativa" : "Desativada"}</span>
            <button
              type="button"
              onClick={handleToggle}
              disabled={toggling}
              className={`relative w-12 h-7 rounded-full transition-colors ${isOn ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
              title={isOn ? "Desativar agendamento" : "Ativar agendamento"}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${isOn ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
        </div>
        {message && <p className={`mt-3 rounded-lg px-4 py-3 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{message.text}</p>}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-title text-base">Editar disponibilidade</h3>
          <span className="text-xs text-gray-400">Edição salva via /api/sections</span>
        </div>
        <BookingAgendaEditor value={draft} onChange={setDraft} />
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button type="button" className="btn btn-outline" onClick={load} disabled={saving}>Descartar</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar agenda"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          💡 Dica: use <b>Dias da semana livres</b> e <b>Horários disponíveis</b> para definir seu expediente. Bloqueie datas específicas e marque horários já ocupados — eles ficam como <b>Ocupado</b> no calendário público instantaneamente.
        </p>
      </div>
    </div>
  );
}
