"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/utils";
import { CrmModal, Field, LoadingState } from "@/components/crm/crm-ui";
import type { CrmGoalRecommendation } from "@/types";

interface GoalEntry {
  id: string | null;
  type: string;
  target_cents: number;
  realized_cents: number;
  realized_sales: number;
  missing_cents: number;
  percent: number;
  projected_cents: number;
  pace: string;
  period_label: string;
  period_key: string;
  diagnosis: string;
}

interface MetasPayload {
  needsSetup?: boolean;
  now: { year: number; month: number; semester: number };
  goals: { monthly: GoalEntry; semiannual: GoalEntry; annual: GoalEntry };
  recommendations: CrmGoalRecommendation[];
  history: { key: string; label: string; realized_cents: number; target_cents: number; percent: number }[];
}

function parseBrToCents(value: string): number {
  const n = parseFloat(String(value).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

function GoalCard({ title, entry }: { title: string; entry: GoalEntry }) {
  const pct = Math.min(100, entry.percent || 0);
  const hasTarget = entry.target_cents > 0;
  return (
    <div className="rounded-xl border border-[#ece7da] p-4 bg-[#fffdf8]">
      <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{title}</p>
      <p className="text-xs text-gray-400 mt-0.5">{entry.period_label}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        {hasTarget ? formatBRL(entry.realized_cents) : "—"}
      </p>
      <p className="text-xs text-gray-500">Meta: {hasTarget ? formatBRL(entry.target_cents) : "não definida"}</p>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[12px] text-[#4a5a52] mb-1.5">
          <span>{hasTarget ? `${entry.percent}%` : "Sem meta"}</span>
          {hasTarget && <span className="font-semibold text-[#0d3320]">Faltam {formatBRL(entry.missing_cents)}</span>}
        </div>
        <div className="h-2.5 w-full rounded-full bg-[#eef2ee] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1d5c3a] to-[#2d7a4f] transition-[width] duration-500"
            style={{ width: `${hasTarget ? pct : 0}%` }}
          />
        </div>
      </div>
      {hasTarget && <p className="mt-2 text-xs text-gray-500">{entry.diagnosis}</p>}
    </div>
  );
}

export default function CrmMetasSection() {
  const [data, setData] = useState<MetasPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [monthlyInput, setMonthlyInput] = useState("");
  const [semiannualInput, setSemiannualInput] = useState("");
  const [annualInput, setAnnualInput] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/metas");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar metas.");
      setData(json);
      const g = json.goals;
      if (g) {
        setMonthlyInput(g.monthly?.target_cents ? String((g.monthly.target_cents / 100).toFixed(2).replace(".", ",")) : "");
        setSemiannualInput(g.semiannual?.target_cents ? String((g.semiannual.target_cents / 100).toFixed(2).replace(".", ",")) : "");
        setAnnualInput(g.annual?.target_cents ? String((g.annual.target_cents / 100).toFixed(2).replace(".", ",")) : "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar metas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      const jobs: { type: string; target_cents: number; year: number; month?: number; semester?: number }[] = [];
      const m = parseBrToCents(monthlyInput);
      const s = parseBrToCents(semiannualInput);
      const a = parseBrToCents(annualInput);
      if (!m && !s && !a) throw new Error("Informe ao menos uma meta (mensal, semestral ou anual).");
      if (m > 0) jobs.push({ type: "monthly", target_cents: m, year: data!.now.year, month: data!.now.month });
      if (s > 0) jobs.push({ type: "semiannual", target_cents: s, year: data!.now.year, semester: data!.now.semester });
      if (a > 0) jobs.push({ type: "annual", target_cents: a, year: data!.now.year });
      for (const j of jobs) {
        const res = await fetch("/api/crm/metas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(j) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao salvar meta.");
      }
      setShowConfig(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCheck(rec: CrmGoalRecommendation) {
    const done = rec.status === "done";
    setToggling(rec.action_key);
    try {
      const res = await fetch("/api/crm/metas/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta_id: data?.goals.monthly.id || null,
          action_key: rec.action_key,
          title: rec.title,
          status: done ? "pending" : "done",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao atualizar.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar ação.");
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="card mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="card-title mb-0">🎯 Minhas Metas</h2>
          <p className="text-xs text-gray-500 mt-1">Progresso calculado com suas vendas reais (exclui canceladas e reembolsadas).</p>
        </div>
        <button className="btn btn-outline text-xs" onClick={() => setShowConfig(true)} disabled={loading}>
          ⚙️ Configurar minhas metas
        </button>
      </div>

      {loading && <LoadingState label="Carregando metas..." />}
      {!loading && error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button className="btn btn-outline text-xs" onClick={load}>Tentar de novo</button>
        </div>
      )}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GoalCard title="Meta mensal" entry={data.goals.monthly} />
            <GoalCard title="Meta semestral" entry={data.goals.semiannual} />
            <GoalCard title="Meta anual" entry={data.goals.annual} />
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">📌 Ações prioritárias</h3>
            {data.recommendations.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma ação pendente. 🎉</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-[#ece7da]">
                {data.recommendations.map((r) => (
                  <li key={r.action_key} className="p-3 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={r.status === "done"}
                      disabled={toggling === r.action_key}
                      onChange={() => toggleCheck(r)}
                      className="mt-1 h-4 w-4 accent-[#1d5c3a]"
                      aria-label={r.title}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${r.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>{r.title}</p>
                      <p className="text-xs text-gray-400">{r.detail}</p>
                    </div>
                    <Link href={r.href} className="text-xs text-[#1d5c3a] underline whitespace-nowrap">Ver</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.history.some((h) => h.target_cents > 0) && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">📊 Histórico (últimos 6 meses)</h3>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Realizado</th>
                      <th>Meta</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h) => (
                      <tr key={h.key}>
                        <td>{h.label}</td>
                        <td>{formatBRL(h.realized_cents)}</td>
                        <td>{h.target_cents > 0 ? formatBRL(h.target_cents) : "—"}</td>
                        <td>{h.target_cents > 0 ? `${h.percent}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showConfig && data && (
        <CrmModal
          title="Configurar minhas metas"
          onClose={() => {
            if (!saving) setShowConfig(false);
          }}
          footer={
            <>
              <button className="btn btn-outline text-xs" onClick={() => setShowConfig(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary text-xs" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar metas"}</button>
            </>
          }
        >
          <p className="text-xs text-gray-500 mb-3">
            Defina valores em R$. Sugestão: use seu faturamento médio como base. O progresso usa apenas vendas com status diferente de Cancelado/Reembolsado.
          </p>
          <Field label={`Meta mensal — ${data.goals.monthly.period_label} (R$)`}>
            <input className="input" inputMode="decimal" placeholder="Ex.: 5.000,00" value={monthlyInput} onChange={(e) => setMonthlyInput(e.target.value)} />
          </Field>
          <Field label={`Meta semestral — ${data.goals.semiannual.period_label} (R$)`}>
            <input className="input" inputMode="decimal" placeholder="Ex.: 30.000,00" value={semiannualInput} onChange={(e) => setSemiannualInput(e.target.value)} />
          </Field>
          <Field label={`Meta anual — ${data.goals.annual.period_label} (R$)`}>
            <input className="input" inputMode="decimal" placeholder="Ex.: 60.000,00" value={annualInput} onChange={(e) => setAnnualInput(e.target.value)} />
          </Field>
          {formError && <p className="text-xs text-red-600 mt-2">{formError}</p>}
        </CrmModal>
      )}
    </div>
  );
}
