"use client";

import { useState } from "react";
import { formatBRL, formatDateTime } from "@/lib/utils";

interface PlanRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  activation_regular_price_cents: number;
  activation_price_cents: number;
  monthly_price_cents: number;
  billing_interval: string;
  offer_title: string | null;
  offer_subtitle: string | null;
  promo_text: string | null;
  cta_text: string | null;
  transparency_text: string | null;
  cancel_text: string | null;
  allow_cancel: boolean;
  trial_days: number;
  trial_months: number;
  media_quota_bytes: number;
  sort_order: number;
  features: string[];
  stripe_product_id: string | null;
  activation_price_id: string | null;
  monthly_price_id: string | null;
  is_active: boolean;
}

interface HistoryRow {
  id: string;
  plan_id: string;
  field: string;
  previous_value_cents: number | null;
  new_value_cents: number | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  activation_regular_price_cents: "Valor normal da ativação",
  activation_price_cents: "Valor promocional da ativação",
  monthly_price_cents: "Mensalidade",
};

function centsToMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoneyToCents(input: string): number {
  let s = input.replace(/[^\d.,-]/g, "").trim();
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const decimalSep = lastComma > lastDot ? lastComma : lastDot;
  let normalized: string;
  if (decimalSep > -1) {
    normalized = s.slice(0, decimalSep).replace(/[.,]/g, "") + "." + s.slice(decimalSep + 1).replace(/[.,]/g, "");
  } else {
    normalized = s.replace(/[.,]/g, "");
  }
  const value = parseFloat(normalized);
  return isNaN(value) ? 0 : Math.round(value * 100);
}

function MoneyField({ value, onChange }: { value: number; onChange: (cents: number) => void }) {
  const [text, setText] = useState(centsToMoney(value));
  return (
    <input
      type="text"
      className="input"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseMoneyToCents(e.target.value));
      }}
      onBlur={() => setText(centsToMoney(value))}
    />
  );
}

export function AdminPlans({ plans, history }: { plans: PlanRow[]; history: HistoryRow[] }) {
  const [list, setList] = useState<PlanRow[]>(plans);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);

  const activeOffer = list.find((p) => p.is_active) || list[0];

  function startNew() {
    setEditing({
      id: "",
      name: "Site Profissional",
      code: "",
      description: "",
      activation_regular_price_cents: 0,
      activation_price_cents: 0,
      monthly_price_cents: 0,
      billing_interval: "month",
      offer_title: "Tenha um site assim hoje mesmo",
      offer_subtitle: "Seu negócio merece uma presença profissional na internet.",
      promo_text: "Oferta especial de lançamento",
      cta_text: "Quero meu site por {price}",
      transparency_text:
        "{activation} corresponde à ativação inicial do site. Após 3 meses, inicia-se a mensalidade de {monthly}. Sem fidelidade e com cancelamento quando quiser.",
      cancel_text: "Sem fidelidade. Cancele quando quiser.",
      allow_cancel: true,
      trial_days: 30,
      trial_months: 3,
      media_quota_bytes: 500 * 1024 * 1024,
      sort_order: 10,
      features: ["Site profissional", "Seu endereço personalizado", "Painel exclusivo", "Personalização do conteúdo", "Site responsivo", "Ferramentas de IA", "Suporte por WhatsApp"],
      stripe_product_id: "",
      activation_price_id: "",
      monthly_price_id: "",
      is_active: true,
    });
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ ok: false, text: data.error || "Erro ao salvar." });
    } else {
      const warnings = Array.isArray(data.warnings) && data.warnings.length ? data.warnings : null;
      const saved: PlanRow = editing.id
        ? editing
        : { ...editing, id: `local-${Date.now()}` };
      setList((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
      });
      setEditing(null);
      setMsg({
        ok: true,
        text: warnings
          ? `Oferta salva. ${warnings.join(" ")}`
          : "Oferta salva. A HOME e o checkout já utilizam os novos valores.",
      });
      if (!warnings) window.location.reload();
    }
    setSaving(false);
  }

  function set(key: keyof PlanRow, value: unknown) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value as never });
  }

  const input = (label: string, key: keyof PlanRow, type: "text" | "number" = "text", hint?: string) => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={String((editing as any)?.[key] ?? "")}
        onChange={(e) => set(key, type === "number" ? Number(e.target.value) : e.target.value)}
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  const money = (label: string, key: keyof PlanRow) => (
    <div>
      <label className="label">{label}</label>
      <MoneyField value={Number((editing as any)?.[key] ?? 0)} onChange={(cents) => set(key, cents)} />
    </div>
  );

  const benefitControls = () => {
    if (!editing) return null;
    const features = editing.features || [];
    const setFeatures = (next: string[]) => set("features", next);
    return (
      <div className="sm:col-span-2">
        <label className="label">Benefícios (exibidos com ✓ na HOME)</label>
        <div className="space-y-2">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="input flex-1"
                value={f}
                onChange={(e) => {
                  const next = [...features];
                  next[i] = e.target.value;
                  setFeatures(next);
                }}
              />
              <button
                type="button"
                className="btn btn-outline !py-1 !px-2 !text-xs"
                disabled={i === 0}
                onClick={() => {
                  const next = [...features];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  setFeatures(next);
                }}
                title="Mover para cima"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-outline !py-1 !px-2 !text-xs"
                disabled={i === features.length - 1}
                onClick={() => {
                  const next = [...features];
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  setFeatures(next);
                }}
                title="Mover para baixo"
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn-outline !py-1 !px-2 !text-xs !text-red-600"
                onClick={() => setFeatures(features.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-outline !py-1.5 !px-3 !text-xs" onClick={() => setFeatures([...features, ""])}>
            + Adicionar benefício
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {msg && (
        <p className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>
      )}

      {/* ---------- OFERTA ATUAL (resumo) ---------- */}
      {activeOffer && (
        <div className="card">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Oferta atual</p>
              <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{activeOffer.name}</h2>
              <span className={`badge ${activeOffer.is_active ? "badge-green" : "badge-gray"} mt-1`}>
                {activeOffer.is_active ? "Ativa" : "Inativa"}
              </span>
            </div>
            <div className="flex gap-2">
              <a href="/?preview=1" target="_blank" className="btn btn-outline !py-2 !px-4 text-xs">Visualizar HOME ↗</a>
              <button className="btn btn-primary !py-2 !px-4 text-xs" onClick={() => setEditing({ ...activeOffer })}>Editar oferta</button>
            </div>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="rounded-lg bg-gray-50 p-3">
              <dt className="text-gray-400 text-xs mb-1">ATIVAÇÃO</dt>
              <dd className="font-semibold">
                {activeOffer.activation_regular_price_cents > 0 && (
                  <span className="line-through text-gray-400 mr-2">{formatBRL(activeOffer.activation_regular_price_cents)}</span>
                )}
                {formatBRL(activeOffer.activation_price_cents)}
              </dd>
              <dd className="text-xs text-gray-400 mt-0.5">pagamento único</dd>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <dt className="text-gray-400 text-xs mb-1">MENSALIDADE</dt>
              <dd className="font-semibold">{formatBRL(activeOffer.monthly_price_cents)}/mês</dd>
              <dd className="text-xs text-gray-400 mt-0.5">
                primeira cobrança após {activeOffer.trial_months || 3} {activeOffer.trial_months === 1 ? "mês" : "meses"}
              </dd>
              <dd className="text-xs text-gray-400 mt-0.5">armazenamento: {(activeOffer.media_quota_bytes || 0) / 1024 / 1024} MB</dd>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <dt className="text-gray-400 text-xs mb-1">CANCELAMENTO</dt>
              <dd className="font-semibold">{activeOffer.allow_cancel ? "Permitido" : "Não permitido"}</dd>
              <dd className="text-xs text-gray-400 mt-0.5">{activeOffer.cancel_text || "—"}</dd>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <dt className="text-gray-400 text-xs mb-1">STRIPE</dt>
              <dd className="font-mono text-xs truncate">ativ: {activeOffer.activation_price_id || "—"}</dd>
              <dd className="font-mono text-xs truncate mt-0.5">mensal: {activeOffer.monthly_price_id || "—"}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* ---------- LISTA DE OFERTAS ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((p) => {
          const hist = history.filter((h) => h.plan_id === p.id);
          return (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="text-xs text-gray-400 mt-1">{p.code}</p>
                </div>
                <span className={`badge ${p.is_active ? "badge-green" : "badge-gray"}`}>{p.is_active ? "Ativo" : "Inativo"}</span>
              </div>
              <dl className="mt-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Ativação</dt>
                  <dd className="font-medium">
                    {p.activation_regular_price_cents > 0 && (
                      <span className="line-through text-gray-400 mr-2">{formatBRL(p.activation_regular_price_cents)}</span>
                    )}
                    {formatBRL(p.activation_price_cents)}
                  </dd>
                </div>
                <div className="flex justify-between"><dt className="text-gray-500">Mensalidade</dt><dd className="font-medium">{formatBRL(p.monthly_price_cents)}/mês</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Primeira cobrança</dt><dd className="font-medium">após {p.trial_months || 3} {p.trial_months === 1 ? "mês" : "meses"}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Armazenamento</dt><dd className="font-medium">{(p.media_quota_bytes || 0) / 1024 / 1024} MB</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Período</dt><dd className="font-medium">{p.billing_interval === "year" ? "Anual" : "Mensal"}</dd></div>
              </dl>
              <div className="flex gap-2 mt-4">
                <button className="btn btn-outline flex-1 !py-2 !text-xs" onClick={() => setEditing({ ...p })}>Editar</button>
                {hist.length > 0 && (
                  <button className="btn btn-outline !py-2 !text-xs" onClick={() => setShowHistory(showHistory === p.id ? null : p.id)}>
                    Histórico ({hist.length})
                  </button>
                )}
              </div>
              {showHistory === p.id && hist.length > 0 && (
                <div className="mt-4 space-y-2">
                  {hist.map((h) => (
                    <div key={h.id} className="rounded-lg bg-gray-50 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{FIELD_LABELS[h.field] || h.field}</span>
                        <span className="text-gray-400">{formatDateTime(h.created_at)}</span>
                      </div>
                      <p className="text-gray-500 mt-0.5">
                        {formatBRL(h.previous_value_cents || 0)} → {formatBRL(h.new_value_cents || 0)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!editing && <button className="btn btn-primary" onClick={startNew}>+ Criar nova oferta</button>}

      {/* ---------- MODAL EDITOR ---------- */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-3xl my-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="card-title">{editing.id ? "Editar oferta" : "Nova oferta"}</h2>
              <button className="text-gray-400 text-xl" onClick={() => setEditing(null)}>✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Fonte de verdade comercial: qualquer alteração aqui reflete automaticamente na HOME, no painel e no checkout.
            </p>
            <div className="max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {input("Nome da oferta", "name")}
                {input("Código (único)", "code")}
                {input("Título da oferta (HOME)", "offer_title")}
                {input("Ordem de exibição", "sort_order", "number")}
                <div className="sm:col-span-2">
                  <label className="label">Subtítulo</label>
                  <textarea className="input min-h-16" value={editing.offer_subtitle || ""} onChange={(e) => set("offer_subtitle", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Descrição</label>
                  <textarea className="input min-h-16" value={editing.description || ""} onChange={(e) => set("description", e.target.value)} />
                </div>

                <div className="sm:col-span-2 border-t border-gray-100 pt-3">
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Ativação do site (pagamento único)</p>
                </div>
                {money("Valor normal da ativação (De R$)", "activation_regular_price_cents")}
                {money("Valor promocional da ativação (Por R$)", "activation_price_cents")}
                {input("Price ID da ativação (Stripe)", "activation_price_id")}

                <div className="sm:col-span-2 border-t border-gray-100 pt-3">
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Assinatura (recorrente)</p>
                </div>
                {money("Valor da mensalidade (R$/mês)", "monthly_price_cents")}
                {input("Price ID da mensalidade (Stripe)", "monthly_price_id")}
                <div>
                  <label className="label">Período de cobrança</label>
                  <select className="input" value={editing.billing_interval} onChange={(e) => set("billing_interval", e.target.value)}>
                    <option value="month">Mensal</option>
                    <option value="year">Anual</option>
                  </select>
                </div>
                {input("Primeira cobrança (meses após a ativação)", "trial_months", "number")}

                <div className="sm:col-span-2 border-t border-gray-100 pt-3">
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Regras e textos</p>
                </div>
                <div>
                  <label className="label">Permite cancelamento</label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <input type="checkbox" className="w-4 h-4 accent-[#1d5c3a]" checked={editing.allow_cancel} onChange={(e) => set("allow_cancel", e.target.checked)} />
                    Sim — o cliente pode cancelar quando quiser
                  </label>
                </div>
                {input("Texto de cancelamento", "cancel_text")}
                {input("Texto promocional (selo da oferta)", "promo_text")}
                {input("Texto do botão (use {price} para o valor)", "cta_text")}
                <div className="sm:col-span-2">
                  <label className="label">{"Texto de transparência (use {activation} e {monthly})"}</label>
                  <textarea className="input min-h-16" value={editing.transparency_text || ""} onChange={(e) => set("transparency_text", e.target.value)} />
                </div>

                {benefitControls()}

                <div className="sm:col-span-2 border-t border-gray-100 pt-3">
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Stripe e status</p>
                </div>
                {input("Stripe Product ID", "stripe_product_id")}
                <div>
                  <label className="label">Limite de armazenamento de mídia (MB)</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    value={Math.round((editing.media_quota_bytes || 0) / 1024 / 1024)}
                    onChange={(e) => set("media_quota_bytes", Math.max(0, Math.round(Number(e.target.value) || 0)) * 1024 * 1024)}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="w-4 h-4 accent-[#1d5c3a]" checked={editing.is_active} onChange={(e) => set("is_active", e.target.checked)} />
                    Oferta ativa (visível na HOME e no checkout)
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !editing.name}>
                {saving ? "Salvando..." : "Salvar oferta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
