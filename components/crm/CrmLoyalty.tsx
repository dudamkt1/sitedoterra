"use client";

import { useEffect, useState } from "react";
import { LoadingState, ErrorState, Toast, Field, apiPost, apiPut } from "@/components/crm/crm-ui";
import type { CrmLoyaltySettings } from "@/types";

interface ClientRow { id: string; name: string; category: string; is_vip: boolean; points: number; level: string }

export default function CrmLoyalty() {
  const [settings, setSettings] = useState<CrmLoyaltySettings | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [adjust, setAdjust] = useState<{ client_id: string; client_name: string; amount: string; description: string } | null>(null);

  const [form, setForm] = useState<Record<string, string>>({});
  const [rulesText, setRulesText] = useState("");
  const [benefitsText, setBenefitsText] = useState("");
  const [rewardsText, setRewardsText] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/loyalty");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar.");
      setSettings(json.settings);
      setClients(json.clients || []);
      setForm({
        program_name: json.settings.program_name,
        points_per_purchase_cents: String(json.settings.points_per_purchase_cents),
        points_per_referral: String(json.settings.points_per_referral),
        points_per_birthday: String(json.settings.points_per_birthday),
        points_per_special: String(json.settings.points_per_special),
      });
      setRulesText((json.settings.rules || []).join("\n"));
      setBenefitsText((json.settings.benefits || []).join("\n"));
      setRewardsText((json.settings.rewards || []).join("\n"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function save(enabled: boolean) {
    setSaving(true);
    setToast(null);
    try {
      await apiPut("/api/crm/loyalty", {
        ...form,
        enabled,
        points_per_purchase_cents: parseInt(form.points_per_purchase_cents) || 0,
        points_per_referral: parseInt(form.points_per_referral) || 0,
        points_per_birthday: parseInt(form.points_per_birthday) || 0,
        points_per_special: parseInt(form.points_per_special) || 0,
        rules: rulesText.split("\n").map((s) => s.trim()).filter(Boolean),
        benefits: benefitsText.split("\n").map((s) => s.trim()).filter(Boolean),
        rewards: rewardsText.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      setToast({ ok: true, text: enabled ? "Programa de fidelidade ativado!" : "Programa desativado (dados preservados)." });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function addPoints() {
    if (!adjust) return;
    try {
      await apiPost("/api/crm/loyalty/points", { client_id: adjust.client_id, amount: parseInt(adjust.amount) || 0, type: "ajuste", description: adjust.description });
      setToast({ ok: true, text: `Pontos ajustados para ${adjust.client_name}!` });
      setAdjust(null);
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao ajustar pontos." });
    }
  }

  if (loading) return <LoadingState label="Carregando fidelidade..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return null;

  const enabled = settings.enabled;

  return (
    <div>
      <Toast msg={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Programa de Fidelidade</h1>
          <p className="text-sm text-gray-500 mt-1">{enabled ? "Programa ativo" : "Programa desativado — nenhum dado é apagado."}</p>
        </div>
        <button
          className={`btn ${enabled ? "btn-outline" : "btn-primary"}`}
          onClick={() => save(!enabled)}
          disabled={saving}
        >
          {enabled ? "Desativar programa" : "Ativar programa"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="card-title mb-4">Configuração do programa</h2>
          <div className="space-y-3">
            <Field label="Nome do programa"><input className="input" value={form.program_name} onChange={(e) => setForm((f) => ({ ...f, program_name: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pontos por R$ 100 em compras"><input type="number" className="input" value={form.points_per_purchase_cents} onChange={(e) => setForm((f) => ({ ...f, points_per_purchase_cents: e.target.value }))} /></Field>
              <Field label="Pontos por indicação"><input type="number" className="input" value={form.points_per_referral} onChange={(e) => setForm((f) => ({ ...f, points_per_referral: e.target.value }))} /></Field>
              <Field label="Pontos por aniversário"><input type="number" className="input" value={form.points_per_birthday} onChange={(e) => setForm((f) => ({ ...f, points_per_birthday: e.target.value }))} /></Field>
              <Field label="Pontos por ações especiais"><input type="number" className="input" value={form.points_per_special} onChange={(e) => setForm((f) => ({ ...f, points_per_special: e.target.value }))} /></Field>
            </div>
            <Field label="Regras de pontuação (uma por linha)">
              <textarea className="input min-h-20" value={rulesText} onChange={(e) => setRulesText(e.target.value)} />
            </Field>
            <Field label="Benefícios (uma por linha)">
              <textarea className="input min-h-20" value={benefitsText} onChange={(e) => setBenefitsText(e.target.value)} />
            </Field>
            <Field label="Prêmios (uma por linha)">
              <textarea className="input min-h-20" value={rewardsText} onChange={(e) => setRewardsText(e.target.value)} />
            </Field>
            <button className="btn btn-primary w-full" disabled={saving} onClick={() => save(enabled)}>{saving ? "Salvando..." : "Salvar configurações"}</button>
          </div>
        </div>

        <div>
          <div className="card mb-4">
            <h2 className="card-title mb-3">Níveis</h2>
            {settings.levels.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum nível configurado.</p>
            ) : (
              <ul className="space-y-2">
                {[...settings.levels].sort((a, b) => a.min_points - b.min_points).map((l) => (
                  <li key={l.name} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                    <span className="font-medium">{l.name}</span>
                    <span className="text-gray-400">{l.min_points} pts</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="card-title mb-3">Clientes e pontos</h2>
            {clients.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">Cadastre clientes para começar a acumular pontos.</p>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="table-base">
                  <thead>
                    <tr><th>Cliente</th><th>Pontos</th><th>Nível</th><th></th></tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.id}>
                        <td className="font-medium text-gray-800">{c.name} {c.is_vip && "⭐"}</td>
                        <td className="font-medium text-[#1d5c3a]">{c.points}</td>
                        <td><span className="badge badge-blue">{c.level}</span></td>
                        <td><button className="btn btn-outline !py-1 !px-2 !text-xs" onClick={() => setAdjust({ client_id: c.id, client_name: c.name, amount: "", description: "" })}>Ajustar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {adjust && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <h3 className="card-title mb-3">Ajustar pontos — {adjust.client_name}</h3>
            <div className="space-y-3">
              <Field label="Pontos (use - para remover)">
                <input type="number" className="input" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
              </Field>
              <Field label="Descrição (opcional)">
                <input className="input" placeholder="Ex.: bônus especial" value={adjust.description} onChange={(e) => setAdjust({ ...adjust, description: e.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-outline" onClick={() => setAdjust(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addPoints}>Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}