"use client";

import { useEffect, useState } from "react";
import { LoadingState, ErrorState, Toast, Field, apiPut, apiPost, apiDelete, confirmDialog, CrmStatusBadge } from "@/components/crm/crm-ui";
import { AUTOMATION_TYPES, DEFAULT_CLIENT_CATEGORIES } from "@/lib/crm-shared";
import type { CrmSettings, CrmAutomation, CrmModuleCode } from "@/types";

const MODULE_OPTIONS: { code: string; label: string; desc: string; icon: string }[] = [
  { code: "fidelidade", label: "Programa de Fidelidade", desc: "Pontos, níveis e benefícios", icon: "🎁" },
  { code: "financeiro", label: "Gestão Financeira", desc: "Entradas, saídas e resultado", icon: "💰" },
  { code: "cobrancas", label: "Cobranças", desc: "A receber e vencimentos", icon: "🧾" },
  { code: "whatsapp", label: "WhatsApp", desc: "Integração e envio de mensagens", icon: "💬" },
  { code: "automacoes", label: "Automações", desc: "Lembretes e regras automáticas", icon: "⚙️" },
  { code: "relatorios", label: "Relatórios avançados", desc: "Gráficos e indicadores", icon: "📈" },
];

export default function CrmSettings({ initialSettings }: { initialSettings: CrmSettings | null }) {
  const [settings, setSettings] = useState<CrmSettings | null>(initialSettings);
  const [automations, setAutomations] = useState<CrmAutomation[]>([]);
  const [loading, setLoading] = useState(!initialSettings);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<string[]>(DEFAULT_CLIENT_CATEGORIES);
  const [newCategory, setNewCategory] = useState("");
  const [incomeCats, setIncomeCats] = useState<string[]>(["Vendas", "Outros recebimentos"]);
  const [expenseCats, setExpenseCats] = useState<string[]>(["Despesas", "Custos", "Outros gastos"]);
  const [vip, setVip] = useState({ minSpent: "", minPurchases: "", minPoints: "", reorderMonths: "" });
  const [automationForm, setAutomationForm] = useState({ type: AUTOMATION_TYPES[0].code, days: "0", schedule_time: "09:00", message: "", enabled: true });
  const [editingAutomation, setEditingAutomation] = useState<CrmAutomation | null>(null);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const [sRes, aRes] = await Promise.all([
        fetch("/api/crm/settings").then((r) => r.json()),
        fetch("/api/crm/automations").then((r) => r.json()),
      ]);
      if (!sRes.settings) throw new Error("Erro ao carregar configurações.");
      setSettings(sRes.settings);
      setCategories(sRes.settings.categories?.length ? sRes.settings.categories : DEFAULT_CLIENT_CATEGORIES);
      setIncomeCats(sRes.settings.financial_categories?.income || ["Vendas", "Outros recebimentos"]);
      setExpenseCats(sRes.settings.financial_categories?.expense || ["Despesas", "Custos", "Outros gastos"]);
      const r = sRes.settings.vip_rules || {};
      setVip({ minSpent: r.minSpentCents ? String(r.minSpentCents / 100) : "", minPurchases: r.minPurchases ? String(r.minPurchases) : "", minPoints: r.minPoints ? String(r.minPoints) : "", reorderMonths: r.reorderMonths ? String(r.reorderMonths) : "" });
      setAutomations(aRes.automations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!initialSettings) loadSettings(); else fetch("/api/crm/automations").then((r) => r.json()).then((j) => setAutomations(j.automations || [])).catch(() => {}); }, []);

  async function saveSettings(applyVip = false) {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/crm/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modules: settings?.modules || {},
          categories,
          financial_categories: { income: incomeCats, expense: expenseCats },
          vip_rules: {
            minSpentCents: Math.round(parseFloat(vip.minSpent.replace(",", ".")) * 100 || 0),
            minPurchases: parseInt(vip.minPurchases) || 0,
            minPoints: parseInt(vip.minPoints) || 0,
            reorderMonths: parseInt(vip.reorderMonths) || 0,
          },
          apply_vip: applyVip,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao salvar.");
      setToast({ ok: true, text: applyVip ? "Configurações salvas e regras de VIP aplicadas!" : "Configurações salvas!" });
      loadSettings();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function toggleModule(code: string) {
    setSettings((s) => {
      if (!s) return s;
      const modules = { ...(s.modules || {}) } as Partial<Record<CrmModuleCode, boolean>>;
      modules[code as CrmModuleCode] = modules[code as CrmModuleCode] === false;
      return { ...s, modules };
    });
  }

  async function saveAutomation() {
    try {
      const body = { ...automationForm, days: parseInt(automationForm.days) || 0 };
      if (editingAutomation) {
        await apiPut(`/api/crm/automations/${editingAutomation.id}`, body);
      } else {
        await apiPost("/api/crm/automations", body);
      }
      setToast({ ok: true, text: "Automação salva!" });
      setAutomationForm({ type: AUTOMATION_TYPES[0].code, days: "0", schedule_time: "09:00", message: "", enabled: true });
      setEditingAutomation(null);
      loadSettings();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar." });
    }
  }

  async function removeAutomation(a: CrmAutomation) {
    if (!confirmDialog("Excluir esta automação?")) return;
    await apiDelete(`/api/crm/automations/${a.id}`);
    loadSettings();
  }

  if (loading) return <LoadingState label="Carregando configurações..." />;
  if (error) return <ErrorState message={error} onRetry={loadSettings} />;
  if (!settings) return null;

  const modules = settings.modules || {};

  return (
    <div>
      <Toast msg={toast} />
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Configurações do CRM</h1>
      <p className="text-sm text-gray-500 mb-6">Ative ou desative módulos, personalize categorias e regras. Desativar nunca apaga dados.</p>

      {/* Módulos */}
      <div className="card mb-6">
        <h2 className="card-title mb-4">Módulos do CRM</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULE_OPTIONS.map((m) => {
            const on = modules[m.code as CrmModuleCode] !== false;
            return (
              <div key={m.code} className={`rounded-xl border p-4 transition-colors ${on ? "border-[#1d5c3a]/30 bg-[#f0f7f2]" : "border-gray-100 bg-gray-50"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5">{m.icon} {m.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleModule(m.code)}
                    className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "left-[1.25rem]" : "left-0.5"}`} />
                  </button>
                </div>
                <p className={`text-xs mt-2 ${on ? "text-green-700" : "text-gray-400"}`}>{on ? "Ativo" : "Desativado (dados preservados)"}</p>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn btn-primary" disabled={saving} onClick={() => saveSettings(false)}>{saving ? "Salvando..." : "Salvar módulos"}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categorias */}
        <div className="card">
          <h2 className="card-title mb-3">Categorias de clientes</h2>
          <p className="text-xs text-gray-400 mb-3">Defina as categorias disponíveis ao cadastrar clientes.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {categories.map((c) => (
              <span key={c} className="badge badge-gray !pr-2 flex items-center gap-1">
                {c}
                <button className="text-gray-400 hover:text-red-500" onClick={() => setCategories(categories.filter((x) => x !== c))}>✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Nova categoria (ex.: Formatura)" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            <button
              className="btn btn-outline"
              onClick={() => {
                const v = newCategory.trim();
                if (v && !categories.includes(v)) setCategories([...categories, v]);
                setNewCategory("");
              }}
            >+ Adicionar</button>
          </div>
        </div>

        {/* Categorias financeiras */}
        <div className="card">
          <h2 className="card-title mb-3">Categorias financeiras</h2>
          <p className="text-xs text-gray-400 mb-3">Entradas e saídas.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Entradas (uma por linha)</label>
              <textarea className="input min-h-24" value={incomeCats.join("\n")} onChange={(e) => setIncomeCats(e.target.value.split("\n").filter(Boolean))} />
            </div>
            <div>
              <label className="label">Saídas (uma por linha)</label>
              <textarea className="input min-h-24" value={expenseCats.join("\n")} onChange={(e) => setExpenseCats(e.target.value.split("\n").filter(Boolean))} />
            </div>
          </div>
        </div>
      </div>

      {/* Regras VIP */}
      <div className="card mt-6">
        <h2 className="card-title mb-1">Regras de clientes VIP</h2>
        <p className="text-xs text-gray-400 mb-4">O sistema identifica automaticamente clientes VIP que atingirem TODOS os critérios preenchidos.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Field label="Gasto mínimo (R$)"><input type="number" className="input" value={vip.minSpent} onChange={(e) => setVip((v) => ({ ...v, minSpent: e.target.value }))} /></Field>
          <Field label="Compras mínimas"><input type="number" className="input" value={vip.minPurchases} onChange={(e) => setVip((v) => ({ ...v, minPurchases: e.target.value }))} /></Field>
          <Field label="Pontos de fidelidade"><input type="number" className="input" value={vip.minPoints} onChange={(e) => setVip((v) => ({ ...v, minPoints: e.target.value }))} /></Field>
          <Field label="Compra há no máx. (meses)"><input type="number" className="input" value={vip.reorderMonths} onChange={(e) => setVip((v) => ({ ...v, reorderMonths: e.target.value }))} /></Field>
        </div>
        <div className="flex flex-wrap justify-end gap-2 mt-4">
          <button className="btn btn-outline" disabled={saving} onClick={() => saveSettings(true)}>Salvar e aplicar regras agora</button>
          <button className="btn btn-primary" disabled={saving} onClick={() => saveSettings(false)}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>

      {/* Automações */}
      <div className="card mt-6">
        <h2 className="card-title mb-1">Automações e lembretes</h2>
        <p className="text-xs text-gray-400 mb-4">
          Configure lembretes e regras. Nada é enviado automaticamente: o sistema gera sugestões/alerts que você
          dispara manualmente, respeitando o consentimento do cliente.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <Field label="Tipo">
            <select className="input" value={automationForm.type} onChange={(e) => {
              const t = AUTOMATION_TYPES.find((x) => x.code === e.target.value)!;
              setAutomationForm((f) => ({ ...f, type: e.target.value, message: f.message || "" }));
            }}>
              {AUTOMATION_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dias"><input type="number" className="input" value={automationForm.days} onChange={(e) => setAutomationForm((f) => ({ ...f, days: e.target.value }))} /></Field>
            <Field label="Horário"><input type="time" className="input" value={automationForm.schedule_time} onChange={(e) => setAutomationForm((f) => ({ ...f, schedule_time: e.target.value }))} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Mensagem sugerida"><textarea className="input min-h-16" value={automationForm.message} onChange={(e) => setAutomationForm((f) => ({ ...f, message: e.target.value }))} /></Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 mb-4">
          {editingAutomation && <button className="btn btn-outline" onClick={() => { setEditingAutomation(null); setAutomationForm({ type: AUTOMATION_TYPES[0].code, days: "0", schedule_time: "09:00", message: "", enabled: true }); }}>Cancelar edição</button>}
          <button className="btn btn-primary" onClick={saveAutomation}>{editingAutomation ? "Salvar alterações" : "+ Criar automação"}</button>
        </div>

        {automations.length === 0 ? (
          <p className="text-sm text-gray-400 py-3">Nenhuma automação configurada.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {automations.map((a) => {
              const meta = AUTOMATION_TYPES.find((t) => t.code === a.type);
              return (
                <li key={a.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{meta?.label || a.type}</p>
                    <p className="text-xs text-gray-400">
                      {a.days} dias · {a.schedule_time || "—"} · {a.message ? a.message.slice(0, 60) + "…" : "sem mensagem"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CrmStatusBadge value={a.enabled ? "Ativo" : "Desativada"} colorMap={{ Ativo: "badge-green", Desativada: "badge-gray" }} />
                    <button className="btn btn-outline !py-1 !px-2 !text-xs" onClick={() => {
                      setEditingAutomation(a);
                      setAutomationForm({ type: a.type, days: String(a.days), schedule_time: a.schedule_time || "09:00", message: a.message || "", enabled: a.enabled });
                    }}>Editar</button>
                    <button className="btn btn-outline !py-1 !px-2 !text-xs text-red-500" onClick={() => removeAutomation(a)}>🗑</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}