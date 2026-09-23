"use client";

import { useEffect, useState } from "react";
import { LoadingState, ErrorState, Toast, Field, EmptyState, apiPost, apiPut } from "@/components/crm/crm-ui";
import { RAFFLE_PRIZE_LABELS, formatBRL } from "@/lib/loyalty-raffle";
import type {
  LoyaltyRaffleCredit,
  LoyaltyRaffleEntry,
  LoyaltyRafflePrizeType,
  LoyaltyRaffleRound,
  LoyaltyRaffleSettings,
} from "@/types";

interface RafflePayload {
  missingMigration?: boolean;
  settings: LoyaltyRaffleSettings | null;
  round: (LoyaltyRaffleRound & { filled_count: number; missing_count: number }) | null;
  entries: LoyaltyRaffleEntry[];
  credits: LoyaltyRaffleCredit[];
  history: (LoyaltyRaffleRound & { winner_name: string | null; winner_number: number | null })[];
}

function toReais(cents: number): string {
  return ((Math.round(Number(cents) || 0) || 0) / 100).toFixed(2).replace(".", ",");
}

export default function CrmRaffle() {
  const [data, setData] = useState<RafflePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const [amountReais, setAmountReais] = useState("50,00");
  const [totalNumbers, setTotalNumbers] = useState("30");
  const [prizeType, setPrizeType] = useState<LoyaltyRafflePrizeType>("brinde");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [prizeCreditReais, setPrizeCreditReais] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/loyalty/raffle");
      const json = (await res.json()) as RafflePayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar sorteio.");
      setData(json);
      if (json.settings) {
        setAmountReais(toReais(json.settings.amount_per_number_cents));
        setTotalNumbers(String(json.settings.total_numbers));
        setPrizeType(json.settings.prize_type);
        setPrizeDescription(json.settings.prize_description || "");
        setPrizeCreditReais(
          json.settings.prize_credit_amount_cents ? toReais(json.settings.prize_credit_amount_cents) : ""
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar sorteio.");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, []);

  async function save(enabled: boolean, patch?: Record<string, unknown>) {
    setSaving(true);
    setToast(null);
    try {
      await apiPut("/api/crm/loyalty/raffle", {
        enabled,
        amount_reais: amountReais,
        total_numbers: parseInt(totalNumbers) || 30,
        prize_type: prizeType,
        prize_description: prizeDescription,
        prize_credit_reais: prizeCreditReais,
        ...(patch || {}),
      });
      setToast({ ok: true, text: enabled ? "Sorteio ativado!" : "Sorteio desativado (dados preservados)." });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function assignNumber(clientId: string) {
    const chosen = parseInt(pick[clientId] || "") || 0;
    if (!chosen) {
      setToast({ ok: false, text: "Digite o número escolhido pelo cliente." });
      return;
    }
    setAssigning(clientId);
    try {
      await apiPost("/api/crm/loyalty/raffle/entries", { client_id: clientId, chosen_number: chosen });
      setToast({ ok: true, text: `Número ${chosen} registrado!` });
      setPick((p) => ({ ...p, [clientId]: "" }));
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao registrar número." });
    } finally {
      setAssigning(null);
    }
  }

  async function drawNow() {
    const total = data?.round?.settings_snapshot.total_numbers || 0;
    const filled = data?.round?.filled_count || 0;
    if (!window.confirm(`Sortear agora entre os ${filled} número(s) preenchidos? A próxima rodada começa automaticamente.`)) return;
    void total;
    setDrawing(true);
    try {
      const res = await apiPost("/api/crm/loyalty/raffle/draw", {});
      const winner = (res as { winner_number?: number; winner_name?: string | null }) || {};
      setToast({
        ok: true,
        text: `🏆 Número ${winner.winner_number} sorteado (${winner.winner_name || "—"})! Nova rodada iniciada.`,
      });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao sortear." });
    } finally {
      setDrawing(false);
    }
  }

  if (loading) return <LoadingState label="Carregando sorteio..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  if (data.missingMigration || !data.settings) {
    return (
      <div className="card">
        <h2 className="card-title mb-2">🎟️ Sorteio por Fidelidade</h2>
        <p className="text-sm text-gray-500">
          As tabelas do sorteio ainda não existem no banco. Aplique a migration{" "}
          <code>0053_loyalty_raffle.sql</code> e recarregue esta página.
        </p>
      </div>
    );
  }

  const s = data.settings;
  const round = data.round;
  const snapTotal = round?.settings_snapshot.total_numbers || s.total_numbers;
  const filled = round?.filled_count || 0;
  const pct = Math.min(100, Math.round((filled / Math.max(1, snapTotal)) * 100));

  return (
    <div>
      <Toast msg={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Sorteio por Fidelidade
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {s.enabled
              ? `Ativo · ${formatBRL(s.amount_per_number_cents)} = 1 número · meta de ${s.total_numbers}`
              : "Desativado — nenhum dado é apagado."}
          </p>
        </div>
        <button
          className={`btn ${s.enabled ? "btn-outline" : "btn-primary"}`}
          onClick={() => save(!s.enabled)}
          disabled={saving}
        >
          {s.enabled ? "Desativar sorteio" : "Ativar sorteio"}
        </button>
      </div>

      {/* ---------- CONFIGURAÇÃO ---------- */}
      <div className="card mb-6">
        <h2 className="card-title mb-4">Configuração</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Field label="R$ por número">
            <input className="input" inputMode="decimal" value={amountReais} onChange={(e) => setAmountReais(e.target.value)} />
            <p className="text-[11px] text-gray-400 mt-1">A cada esse valor em compras = 1 número</p>
          </Field>
          <Field label="Total de números (meta)">
            <input type="number" min={2} max={1000} className="input" value={totalNumbers} onChange={(e) => setTotalNumbers(e.target.value)} />
            <p className="text-[11px] text-gray-400 mt-1">Vale para a PRÓXIMA rodada</p>
          </Field>
          <Field label="Tipo de prêmio">
            <select className="input" value={prizeType} onChange={(e) => setPrizeType(e.target.value as LoyaltyRafflePrizeType)}>
              {(Object.keys(RAFFLE_PRIZE_LABELS) as LoyaltyRafflePrizeType[]).map((t) => (
                <option key={t} value={t}>
                  {RAFFLE_PRIZE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          {prizeType === "credito_loja" && (
            <Field label="Valor do crédito (R$)">
              <input className="input" inputMode="decimal" value={prizeCreditReais} onChange={(e) => setPrizeCreditReais(e.target.value)} />
            </Field>
          )}
        </div>
        <Field label="Descrição do prêmio">
          <input className="input" placeholder="Ex.: Kit Lavanda + difusor" value={prizeDescription} onChange={(e) => setPrizeDescription(e.target.value)} />
        </Field>
        <button className="btn btn-primary w-full mt-3" disabled={saving} onClick={() => save(s.enabled)}>
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
        <p className="text-[11px] text-gray-400 mt-2">
          Mudanças de valor/meta/prêmio valem para a próxima rodada — a rodada atual guarda um retrato
          (snapshot) para não quebrar o que já foi combinado.
        </p>
      </div>

      {/* ---------- RODADA ATUAL ---------- */}
      {round && (
        <div className="card mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="card-title mb-0">Rodada atual</h2>
            <button className="btn btn-primary !py-2 !px-4 !text-sm" disabled={drawing || filled === 0} onClick={drawNow}>
              {drawing ? "Sorteando..." : "🎲 Realizar sorteio agora"}
            </button>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-[#1d5c3a] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            {filled} de {snapTotal} números escolhidos · faltam {Math.max(0, snapTotal - filled)}
          </p>
          {data.entries.length === 0 ? (
            <EmptyState icon="🎟️" title="Nenhum número escolhido ainda." sub="Registre vendas confirmadas e atribua os números aos clientes." />
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {data.entries.map((e) => (
                <div key={e.id} className="rounded-lg border border-[#1d5c3a] bg-[#1d5c3a] text-white px-1 py-2 text-center" title={e.client_name || ""}>
                  <p className="text-sm font-bold leading-none">{e.chosen_number}</p>
                  <p className="text-[10px] leading-tight mt-0.5 truncate">{e.client_name || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- CRÉDITOS PENDENTES ---------- */}
      <div className="card mb-6">
        <h2 className="card-title mb-1">Números a escolher</h2>
        <p className="text-sm text-gray-500 mb-4">
          Clientes com crédito de número (de compras confirmadas) aguardando a escolha do número.
        </p>
        {data.credits.length === 0 ? (
          <EmptyState icon="🛒" title="Nenhum crédito pendente." sub="Novos créditos aparecem aqui quando uma venda é confirmada." />
        ) : (
          <ul className="space-y-2">
            {data.credits.map((c) => {
              const pending = c.numbers_pending ?? c.numbers_total - c.numbers_used;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <span className="flex-1 min-w-40 text-sm">
                    <strong>{c.client_name || "Cliente"}</strong>{" "}
                    <span className="text-gray-400">· {pending} número(s) pendente(s)</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={snapTotal}
                    className="input !w-28 !py-1.5"
                    placeholder="Nº"
                    value={pick[`${c.client_id}`] || ""}
                    onChange={(e) => setPick((p) => ({ ...p, [`${c.client_id}`]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn btn-outline !py-1.5 !px-3 !text-xs"
                    disabled={assigning === c.client_id}
                    onClick={() => assignNumber(c.client_id)}
                  >
                    {assigning === c.client_id ? "Salvando..." : "Atribuir"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---------- HISTÓRICO ---------- */}
      <div className="card mb-6">
        <h2 className="card-title mb-3">🏆 Rodadas anteriores</h2>
        {data.history.length === 0 ? (
          <EmptyState icon="📜" title="Nenhum sorteio realizado ainda." />
        ) : (
          <ul className="space-y-2">
            {data.history.map((h) => (
              <li key={h.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                <strong>{h.winner_name || "—"}</strong> ganhou{" "}
                <strong>{h.settings_snapshot.prize_description || "o prêmio"}</strong> com o número{" "}
                <strong>{h.winner_number}</strong>
                <span className="text-xs text-gray-400 block">
                  {h.drawn_at ? new Date(h.drawn_at).toLocaleString("pt-BR") : ""} · semente{" "}
                  {h.random_seed ? `${h.random_seed.slice(0, 8)}…` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
