"use client";

import { useEffect, useMemo, useState } from "react";
import { LoadingState, ErrorState, Toast, Field, EmptyState, CrmModal, apiPost, apiPut } from "@/components/crm/crm-ui";
import { sortedLevels, levelPosition, isCloseToNextLevel, levelDiscountLabel } from "@/lib/crm-loyalty";
import type { CrmLoyaltySettings, CrmLoyaltyLevel, CrmLoyaltyRedeemable } from "@/types";

interface ClientRow { id: string; name: string; category: string; is_vip: boolean; points: number; level: string }
interface LevelStats { name: string; min_points: number; count: number }
interface ProgramStats { participants: number; totalClients: number; distributed: number; unlocked: number; perLevel: LevelStats[] }
interface HistoryRow { id: string; amount: number; type: string; description: string | null; created_at: string; balance_after: number }

const LEVEL_STYLES = [
  "bg-amber-50 text-amber-800 border-amber-200",
  "bg-slate-100 text-slate-700 border-slate-200",
  "bg-yellow-50 text-yellow-800 border-yellow-200",
  "bg-violet-50 text-violet-800 border-violet-200",
];

function levelStyle(index: number) {
  return LEVEL_STYLES[Math.min(Math.max(index, 0), LEVEL_STYLES.length - 1)];
}

function linesToText(list: string[] | undefined): string {
  return (list || []).join("\n");
}
function textToLines(text: string): string[] {
  return text.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 50);
}

interface LevelDraft {
  index: number | null;
  name: string;
  min_points: string;
  discount_percent: string;
  benefits: string;
  rewards: string;
  gifts: string;
  conditions: string;
}

const EMPTY_DRAFT: LevelDraft = { index: null, name: "", min_points: "", discount_percent: "", benefits: "", rewards: "", gifts: "", conditions: "" };

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full bg-[#1d5c3a] transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export default function CrmLoyalty() {
  const [settings, setSettings] = useState<CrmLoyaltySettings | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [stats, setStats] = useState<ProgramStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [adjust, setAdjust] = useState<{ client_id: string; client_name: string; amount: string; description: string } | null>(null);

  const [form, setForm] = useState<Record<string, string>>({});
  const [rulesText, setRulesText] = useState("");
  const [benefitsText, setBenefitsText] = useState("");
  const [rewardsText, setRewardsText] = useState("");
  const [levels, setLevels] = useState<CrmLoyaltyLevel[]>([]);
  const [redeemables, setRedeemables] = useState<CrmLoyaltyRedeemable[]>([]);
  const [newRedeemable, setNewRedeemable] = useState({ name: "", cost: "", description: "" });

  const [levelDraft, setLevelDraft] = useState<LevelDraft | null>(null);
  const [viewClient, setViewClient] = useState<ClientRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/loyalty");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar.");
      const s = json.settings as CrmLoyaltySettings;
      setSettings(s);
      setClients(json.clients || []);
      setStats(json.stats || null);
      setForm({
        program_name: s.program_name,
        points_per_purchase_cents: String(s.points_per_purchase_cents),
        points_per_referral: String(s.points_per_referral),
        points_per_birthday: String(s.points_per_birthday),
        points_per_special: String(s.points_per_special),
      });
      setRulesText(linesToText(s.rules));
      setBenefitsText(linesToText(s.benefits));
      setRewardsText(linesToText(s.rewards));
      setLevels(sortedLevels(s.levels));
      setRedeemables(Array.isArray(s.redeemables) ? s.redeemables : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function openClientDetail(c: ClientRow) {
    setViewClient(c);
    setHistory(null);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/crm/loyalty/history?client_id=${encodeURIComponent(c.id)}`);
      const json = await res.json();
      if (res.ok) setHistory(json.history || []);
    } catch {
      // histórico indisponível não bloqueia a visão do cliente
    } finally {
      setHistoryLoading(false);
    }
  }

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
        rules: textToLines(rulesText),
        benefits: textToLines(benefitsText),
        rewards: textToLines(rewardsText),
        levels,
        redeemables,
      });
      setToast({ ok: true, text: enabled ? "Programa de fidelidade ativado!" : "Programa desativado (dados preservados)." });
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  function saveLevelDraft() {
    if (!levelDraft || !levelDraft.name.trim()) {
      setToast({ ok: false, text: "Dê um nome ao nível." });
      return;
    }
    const discount = parseInt(levelDraft.discount_percent);
    const level: CrmLoyaltyLevel = {
      name: levelDraft.name.trim().slice(0, 40),
      min_points: Math.max(0, parseInt(levelDraft.min_points) || 0),
      benefits: textToLines(levelDraft.benefits),
      rewards: textToLines(levelDraft.rewards),
      discount_percent: !isNaN(discount) && discount > 0 ? Math.min(100, discount) : null,
      gifts: textToLines(levelDraft.gifts),
      conditions: textToLines(levelDraft.conditions),
    };
    setLevels((prev) => {
      const next = [...prev];
      if (levelDraft.index === null) next.push(level);
      else next[levelDraft.index] = level;
      return sortedLevels(next);
    });
    setLevelDraft(null);
    setToast({ ok: true, text: "Nível atualizado. Clique em “Salvar configurações” para aplicar." });
  }

  function deleteLevel(index: number) {
    const target = levels[index];
    if (!target) return;
    if (!window.confirm(`Excluir o nível “${target.name}”? Clientes nele serão reclassificados automaticamente. Os pontos de ninguém mudam.`)) return;
    setLevels((prev) => prev.filter((_, i) => i !== index));
    setToast({ ok: true, text: "Nível removido. Clique em “Salvar configurações” para aplicar." });
  }

  function addRedeemable() {
    const cost = parseInt(newRedeemable.cost) || 0;
    if (!newRedeemable.name.trim() || cost <= 0) {
      setToast({ ok: false, text: "Informe o nome do benefício e o custo em pontos." });
      return;
    }
    setRedeemables((prev) => [
      ...prev,
      { id: `rd_${Date.now()}`, name: newRedeemable.name.trim().slice(0, 80), cost_points: cost, description: newRedeemable.description.trim().slice(0, 200) || null },
    ]);
    setNewRedeemable({ name: "", cost: "", description: "" });
    setToast({ ok: true, text: "Benefício adicionado. Clique em “Salvar configurações” para aplicar." });
  }

  async function addPoints() {
    if (!adjust) return;
    try {
      await apiPost("/api/crm/loyalty/points", { client_id: adjust.client_id, amount: parseInt(adjust.amount) || 0, type: "ajuste", description: adjust.description });
      setToast({ ok: true, text: `Pontos ajustados para ${adjust.client_name}!` });
      setAdjust(null);
      setViewClient(null);
      load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao ajustar pontos." });
    }
  }

  const closeClients = useMemo(() => {
    return clients
      .map((c) => ({ client: c, pos: levelPosition(levels, c.points) }))
      .filter(({ pos }) => pos.next && isCloseToNextLevel(pos.missing, pos.progress))
      .sort((a, b) => a.pos.missing - b.pos.missing)
      .slice(0, 5);
  }, [clients, levels]);

  if (loading) return <LoadingState label="Carregando fidelidade..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return null;

  const enabled = settings.enabled;
  const viewPos = viewClient ? levelPosition(levels, viewClient.points) : null;
  const ratePer100 = parseInt(form.points_per_purchase_cents) || 0;

  return (
    <div>
      <Toast msg={toast} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Programa de Fidelidade</h1>
          <p className="text-sm text-gray-500 mt-1">{enabled ? `${settings.program_name} · ativo` : "Programa desativado — nenhum dado é apagado."}</p>
        </div>
        <button
          className={`btn ${enabled ? "btn-outline" : "btn-primary"}`}
          onClick={() => save(!enabled)}
          disabled={saving}
        >
          {enabled ? "Desativar programa" : "Ativar programa"}
        </button>
      </div>

      {/* ---------- DASHBOARD ---------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card !py-4">
          <p className="text-2xl font-bold text-[#1d5c3a]">{stats?.participants ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Clientes participantes</p>
        </div>
        <div className="card !py-4">
          <p className="text-2xl font-bold text-[#1d5c3a]">{(stats?.distributed ?? 0).toLocaleString("pt-BR")}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pontos distribuídos</p>
        </div>
        <div className="card !py-4">
          <p className="text-2xl font-bold text-[#1d5c3a]">{stats?.unlocked ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Com benefícios desbloqueados</p>
        </div>
        <div className="card !py-4">
          <p className="text-2xl font-bold text-[#1d5c3a]">{levels.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Níveis no programa</p>
        </div>
      </div>

      {stats && stats.perLevel.length > 0 && (
        <div className="card mb-6">
          <h2 className="card-title mb-3">Clientes por nível</h2>
          <div className="space-y-2">
            {stats.perLevel.map((l, i) => {
              const max = Math.max(1, ...stats.perLevel.map((x) => x.count));
              return (
                <div key={l.name} className="flex items-center gap-3">
                  <span className={`badge border ${levelStyle(i)} shrink-0 min-w-20 justify-center`}>{l.name}</span>
                  <div className="flex-1"><ProgressBar value={(l.count / max) * 100} /></div>
                  <span className="text-xs text-gray-500 w-16 text-right">{l.count} cliente(s)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------- COMO FUNCIONA ---------- */}
      <div className="card mb-6">
        <h2 className="card-title mb-2">Como funciona</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Seus clientes acumulam pontos através de compras, indicações e ações especiais. Conforme acumulam pontos,
          avançam de nível e desbloqueiam novos benefícios.
        </p>
      </div>

      {/* ---------- NÍVEIS ---------- */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="card-title mb-0">Níveis de fidelidade</h2>
          <button type="button" className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => setLevelDraft({ ...EMPTY_DRAFT })}>
            + Criar nível
          </button>
        </div>
        {levels.length === 0 ? (
          <EmptyState icon="🏆" title="Nenhum nível configurado." sub="Crie o primeiro nível para começar o programa." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {levels.map((l, i) => {
              const discount = levelDiscountLabel(l);
              return (
                <div key={`${l.name}-${i}`} className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`badge border ${levelStyle(i)}`}>{l.name}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="text-xs text-gray-400 hover:text-[#1d5c3a] px-1"
                        title="Editar nível"
                        onClick={() => setLevelDraft({
                          index: i, name: l.name, min_points: String(l.min_points || 0),
                          discount_percent: l.discount_percent ? String(l.discount_percent) : "",
                          benefits: linesToText(l.benefits), rewards: linesToText(l.rewards),
                          gifts: linesToText(l.gifts), conditions: linesToText(l.conditions),
                        })}
                      >✏️</button>
                      <button type="button" className="text-xs text-gray-400 hover:text-red-600 px-1" title="Excluir nível" onClick={() => deleteLevel(i)}>🗑️</button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{(l.min_points || 0).toLocaleString("pt-BR")} pontos para alcançar</p>
                  <div className="space-y-1.5 text-[13px] text-gray-700 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Benefícios</p>
                    {discount && <p>✓ {discount}</p>}
                    {(l.benefits || []).map((b, bi) => <p key={bi}>✓ {b}</p>)}
                    {(!discount && (!l.benefits || l.benefits.length === 0)) && <p className="text-gray-400">✓ Participação no programa</p>}
                    {(l.gifts || []).length > 0 && (
                      <>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 pt-1">Brindes</p>
                        {l.gifts!.map((g, gi) => <p key={gi}>🎁 {g}</p>)}
                      </>
                    )}
                    {(l.rewards || []).length > 0 && (
                      <>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 pt-1">Recompensas</p>
                        {l.rewards!.map((r, ri) => <p key={ri}>🏆 {r}</p>)}
                      </>
                    )}
                    {(l.conditions || []).length > 0 && (
                      <>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 pt-1">Condições especiais</p>
                        {l.conditions!.map((cd, ci) => <p key={ci}>• {cd}</p>)}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- ALERTAS ---------- */}
      {closeClients.length > 0 && (
        <div className="card mb-6 !border-amber-200 !bg-amber-50/50">
          <h2 className="card-title mb-3">🎯 Perto de subir de nível</h2>
          <ul className="space-y-2">
            {closeClients.map(({ client, pos }) => (
              <li key={client.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700">
                <span>🎯 <strong>{client.name}</strong> está a apenas <strong>{pos.missing} pontos</strong> de alcançar <strong>{pos.next!.name}</strong>.</span>
                <button type="button" className="text-xs text-[#1d5c3a] underline" onClick={() => openClientDetail(client)}>
                  Ver progresso
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-3">Estimule uma nova compra ou ação para destravar o próximo nível.</p>
        </div>
      )}

      {/* ---------- CLIENTES ---------- */}
      <div className="card mb-6">
        <h2 className="card-title mb-3">Clientes e progresso</h2>
        {clients.length === 0 ? (
          <EmptyState icon="👥" title="Cadastre clientes para começar a acumular pontos." />
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="table-base min-w-[640px]">
              <thead>
                <tr><th>Cliente</th><th>Pontos</th><th>Nível</th><th className="min-w-44">Progresso</th><th></th></tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const pos = levelPosition(levels, c.points);
                  const idx = levels.findIndex((l) => l.name === pos.level?.name);
                  return (
                    <tr key={c.id}>
                      <td className="font-medium text-gray-800">{c.name} {c.is_vip && "⭐"}</td>
                      <td className="font-medium text-[#1d5c3a]">{c.points.toLocaleString("pt-BR")}</td>
                      <td><span className={`badge border ${levelStyle(idx)}`}>{c.level}</span></td>
                      <td>
                        {pos.next ? (
                          <div>
                            <ProgressBar value={pos.progress} />
                            <p className="text-[11px] text-gray-400 mt-1">
                              Faltam <strong className="text-gray-600">{pos.missing}</strong> para {pos.next.name}
                              {isCloseToNextLevel(pos.missing, pos.progress) && " 🎯"}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-400">Nível máximo 🏆</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <button type="button" className="btn btn-outline !py-1 !px-2 !text-xs mr-1" onClick={() => openClientDetail(c)}>Ver</button>
                        <button type="button" className="btn btn-outline !py-1 !px-2 !text-xs" onClick={() => setAdjust({ client_id: c.id, client_name: c.name, amount: "", description: "" })}>Ajustar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- REGRAS ---------- */}
      <div className="card mb-6">
        <h2 className="card-title mb-1">Regras de pontuação</h2>
        <p className="text-sm text-gray-500 mb-4">Quanto vale cada ação no seu programa. Tudo editável.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Field label="Pontos por R$ 100 em compras">
            <input type="number" min={0} className="input" value={form.points_per_purchase_cents} onChange={(e) => setForm((f) => ({ ...f, points_per_purchase_cents: e.target.value }))} />
            <p className="text-[11px] text-gray-400 mt-1">R$ 100 em compras = {ratePer100} pontos</p>
          </Field>
          <Field label="Pontos por indicação">
            <input type="number" min={0} className="input" value={form.points_per_referral} onChange={(e) => setForm((f) => ({ ...f, points_per_referral: e.target.value }))} />
            <p className="text-[11px] text-gray-400 mt-1">Indicação = {parseInt(form.points_per_referral) || 0} pontos</p>
          </Field>
          <Field label="Pontos por aniversário">
            <input type="number" min={0} className="input" value={form.points_per_birthday} onChange={(e) => setForm((f) => ({ ...f, points_per_birthday: e.target.value }))} />
            <p className="text-[11px] text-gray-400 mt-1">Aniversário = {parseInt(form.points_per_birthday) || 0} pontos</p>
          </Field>
          <Field label="Pontos por ação especial">
            <input type="number" min={0} className="input" value={form.points_per_special} onChange={(e) => setForm((f) => ({ ...f, points_per_special: e.target.value }))} />
            <p className="text-[11px] text-gray-400 mt-1">Ação especial = {parseInt(form.points_per_special) || 0} pontos</p>
          </Field>
        </div>
        <Field label="Regras do programa (uma por linha)">
          <textarea className="input min-h-20" value={rulesText} onChange={(e) => setRulesText(e.target.value)} placeholder={"Ex.: R$ 100 em compras = " + ratePer100 + " pontos"} />
        </Field>
      </div>

      {/* ---------- RESGATÁVEIS ---------- */}
      <div className="card mb-6">
        <h2 className="card-title mb-1">Benefícios resgatáveis</h2>
        <p className="text-sm text-gray-500 mb-4">
          Catálogo de recompensas com custo em pontos. O resgate é feito pelo botão “Ajustar” do cliente (pontos negativos, tipo resgate) — registrado no histórico com auditoria.
        </p>
        {redeemables.length === 0 ? (
          <p className="text-sm text-gray-400 mb-3">Nenhum benefício resgatável cadastrado.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {redeemables.map((r, i) => (
              <li key={r.id || i} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-lg">🎁</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                  {r.description && <p className="text-xs text-gray-400 truncate">{r.description}</p>}
                </div>
                <span className="badge badge-gold shrink-0">{r.cost_points} pts</span>
                <button
                  type="button" className="text-xs text-gray-400 hover:text-red-600 shrink-0"
                  onClick={() => setRedeemables((prev) => prev.filter((_, x) => x !== i))}
                >🗑️</button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_1fr_auto] gap-2">
          <input className="input" placeholder="Ex.: 10% de desconto" value={newRedeemable.name} onChange={(e) => setNewRedeemable((s) => ({ ...s, name: e.target.value }))} />
          <input type="number" min={1} className="input" placeholder="Custo (pts)" value={newRedeemable.cost} onChange={(e) => setNewRedeemable((s) => ({ ...s, cost: e.target.value }))} />
          <input className="input" placeholder="Descrição (opcional)" value={newRedeemable.description} onChange={(e) => setNewRedeemable((s) => ({ ...s, description: e.target.value }))} />
          <button type="button" className="btn btn-outline whitespace-nowrap" onClick={addRedeemable}>+ Adicionar</button>
        </div>
      </div>

      {/* ---------- CONFIG GERAL ---------- */}
      <div className="card mb-6">
        <h2 className="card-title mb-4">Configuração do programa</h2>
        <div className="space-y-3">
          <Field label="Nome do programa">
            <input className="input" value={form.program_name} onChange={(e) => setForm((f) => ({ ...f, program_name: e.target.value }))} />
          </Field>
          <Field label="Benefícios gerais (uma por linha — valem para todos os níveis)">
            <textarea className="input min-h-20" value={benefitsText} onChange={(e) => setBenefitsText(e.target.value)} />
          </Field>
          <Field label="Prêmios gerais (uma por linha)">
            <textarea className="input min-h-20" value={rewardsText} onChange={(e) => setRewardsText(e.target.value)} />
          </Field>
          <button className="btn btn-primary w-full" disabled={saving} onClick={() => save(enabled)}>{saving ? "Salvando..." : "Salvar configurações"}</button>
        </div>
      </div>

      {/* ---------- MODAL NÍVEL ---------- */}
      {levelDraft && (
        <CrmModal
          title={levelDraft.index === null ? "＋ Criar nível" : `✏️ Editar nível`}
          onClose={() => setLevelDraft(null)}
          wide
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setLevelDraft(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={saveLevelDraft}>Salvar nível</button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Nome do nível">
              <input className="input" placeholder="Ex.: Prata" value={levelDraft.name} onChange={(e) => setLevelDraft({ ...levelDraft, name: e.target.value })} />
            </Field>
            <Field label="Pontos necessários">
              <input type="number" min={0} className="input" placeholder="Ex.: 100" value={levelDraft.min_points} onChange={(e) => setLevelDraft({ ...levelDraft, min_points: e.target.value })} />
            </Field>
            <Field label="Desconto % (opcional)">
              <input type="number" min={0} max={100} className="input" placeholder="Ex.: 5" value={levelDraft.discount_percent} onChange={(e) => setLevelDraft({ ...levelDraft, discount_percent: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <Field label="Benefícios (um por linha)">
              <textarea className="input min-h-24" placeholder={"5% de desconto\nBrinde especial"} value={levelDraft.benefits} onChange={(e) => setLevelDraft({ ...levelDraft, benefits: e.target.value })} />
            </Field>
            <Field label="Recompensas (uma por linha)">
              <textarea className="input min-h-24" placeholder="Voucher R$ 50" value={levelDraft.rewards} onChange={(e) => setLevelDraft({ ...levelDraft, rewards: e.target.value })} />
            </Field>
            <Field label="Brindes (um por linha)">
              <textarea className="input min-h-24" placeholder="Brinde especial" value={levelDraft.gifts} onChange={(e) => setLevelDraft({ ...levelDraft, gifts: e.target.value })} />
            </Field>
            <Field label="Condições especiais (uma por linha)">
              <textarea className="input min-h-24" placeholder="Frete com condição especial" value={levelDraft.conditions} onChange={(e) => setLevelDraft({ ...levelDraft, conditions: e.target.value })} />
            </Field>
          </div>
        </CrmModal>
      )}

      {/* ---------- MODAL CLIENTE ---------- */}
      {viewClient && viewPos && (
        <CrmModal title={`👤 ${viewClient.name}`} onClose={() => setViewClient(null)} wide>
          {/* MEU NÍVEL */}
          <div className="rounded-xl border border-gray-200 p-4 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Meu nível</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge border text-sm ${levelStyle(levels.findIndex((l) => l.name === viewPos.level?.name))}`}>
                {viewPos.level?.name || viewClient.level}
              </span>
              <span className="text-sm font-bold text-[#1d5c3a]">{viewClient.points.toLocaleString("pt-BR")} pontos</span>
            </div>
            <div className="mt-3"><ProgressBar value={viewPos.progress} /></div>
            <p className="text-xs text-gray-500 mt-2">
              {viewPos.next
                ? <><strong className="text-gray-700">{viewPos.missing} pontos</strong> para {viewPos.next.name} ({(viewPos.next.min_points || 0).toLocaleString("pt-BR")} pontos)</>
                : "Nível máximo alcançado 🏆"}
            </p>
          </div>

          {/* BENEFÍCIOS DESBLOQUEADOS */}
          <div className="rounded-xl border border-gray-200 p-4 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Benefícios desbloqueados</p>
            {(() => {
              const discount = levelDiscountLabel(viewPos.level);
              const mine = [...(viewPos.level?.benefits || []), ...(settings.benefits || [])];
              if (!discount && mine.length === 0) return <p className="text-sm text-gray-400">Nenhum benefício configurado para este nível ainda.</p>;
              return (
                <ul className="space-y-1 text-sm text-gray-700">
                  {discount && <li>✓ {discount}</li>}
                  {mine.map((b, i) => <li key={i}>✓ {b}</li>)}
                </ul>
              );
            })()}
          </div>

          {/* PRÓXIMO NÍVEL */}
          {viewPos.next && (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 mb-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Próximo nível</p>
              <p className="text-sm font-bold text-gray-800">{viewPos.next.name} · {(viewPos.next.min_points || 0).toLocaleString("pt-BR")} pontos</p>
              <p className="text-xs text-gray-500 mt-1">Continue acumulando pontos para desbloquear novos benefícios.</p>
            </div>
          )}

          {/* RESGATÁVEIS */}
          {redeemables.length > 0 && (
            <div className="rounded-xl border border-gray-200 p-4 mb-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Resgatar benefício</p>
              <ul className="space-y-2">
                {redeemables.map((r, i) => {
                  const afford = viewClient.points >= r.cost_points;
                  return (
                    <li key={r.id || i} className="flex items-center gap-2 text-sm">
                      <span>🎁</span>
                      <span className="flex-1 min-w-0"><strong>{r.name}</strong> <span className="text-gray-400">· {r.cost_points} pts</span></span>
                      <span className={`text-xs font-medium ${afford ? "text-green-700" : "text-gray-400"}`}>
                        {afford ? "✓ tem pontos" : `faltam ${r.cost_points - viewClient.points}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-gray-400 mt-2">Para resgatar, use “Ajustar pontos” com valor negativo — fica registrado no histórico.</p>
            </div>
          )}

          {/* HISTÓRICO */}
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Histórico de pontos</p>
            {historyLoading ? (
              <p className="text-sm text-gray-400">Carregando histórico...</p>
            ) : !history || history.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma movimentação registrada.</p>
            ) : (
              <div className="overflow-x-auto -mx-1 px-1 max-h-72 overflow-y-auto">
                <table className="table-base min-w-[480px]">
                  <thead><tr><th>Data</th><th>Descrição</th><th>Pontos</th><th>Saldo</th></tr></thead>
                  <tbody>
                    {[...history].reverse().map((h) => (
                      <tr key={h.id}>
                        <td className="whitespace-nowrap">{new Date(h.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className="text-sm text-gray-600">{h.description || h.type}</td>
                        <td className={`font-medium whitespace-nowrap ${h.amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {h.amount >= 0 ? `+${h.amount}` : h.amount}
                        </td>
                        <td className="text-gray-500">{h.balance_after.toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button" className="btn btn-outline !py-2 !px-3 !text-xs"
                onClick={() => setAdjust({ client_id: viewClient.id, client_name: viewClient.name, amount: "", description: "" })}
              >
                Ajustar pontos
              </button>
            </div>
          </div>
        </CrmModal>
      )}

      {/* ---------- MODAL AJUSTE ---------- */}
      {adjust && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <h3 className="card-title mb-3">Ajustar pontos — {adjust.client_name}</h3>
            <div className="space-y-3">
              <Field label="Pontos (use - para remover/resgatar)">
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
