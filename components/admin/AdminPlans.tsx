"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/utils";

interface PlanRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  activation_price_cents: number;
  monthly_price_cents: number;
  billing_interval: string;
  is_active: boolean;
  priceLabel: string;
  activationLabel: string;
}

export function AdminPlans({ plans }: { plans: PlanRow[] }) {
  const [editing, setEditing] = useState<Partial<PlanRow> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function startNew() {
    setEditing({
      name: "",
      code: "",
      description: "",
      activation_price_cents: 0,
      monthly_price_cents: 0,
      billing_interval: "month",
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
      body: JSON.stringify({
        id: editing.id,
        name: editing.name,
        code: editing.code,
        description: editing.description,
        activation_price_cents: editing.activation_price_cents,
        monthly_price_cents: editing.monthly_price_cents,
        billing_interval: editing.billing_interval,
        is_active: editing.is_active,
      }),
    });
    const data = await res.json();
    setMsg(data.success ? "Plano salvo." : data.error || "Erro ao salvar.");
    setSaving(false);
    if (data.success) {
      setEditing(null);
      window.location.reload();
    }
  }

  const input = (label: string, key: keyof PlanRow, type = "text") => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={String((editing as any)?.[key] ?? "")}
        onChange={(e) => setEditing({ ...(editing as any), [key]: type === "number" ? Number(e.target.value) : e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((p) => (
          <div key={p.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{p.name}</h2>
                <p className="text-xs text-gray-400 mt-1">{p.code}</p>
              </div>
              <span className={`badge ${p.is_active ? "badge-green" : "badge-gray"}`}>{p.is_active ? "Ativo" : "Inativo"}</span>
            </div>
            <dl className="mt-4 text-sm space-y-2">
              <div className="flex justify-between"><dt className="text-gray-500">Mensalidade</dt><dd className="font-medium">{p.priceLabel}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Ativação</dt><dd className="font-medium">{p.activationLabel}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Período</dt><dd className="font-medium">{p.billing_interval === "year" ? "Anual" : "Mensal"}</dd></div>
            </dl>
            <button className="btn btn-outline w-full mt-4" onClick={() => setEditing({ ...p })}>Editar</button>
          </div>
        ))}
      </div>

      {!editing && <button className="btn btn-primary" onClick={startNew}>+ Criar novo plano</button>}

      {editing && (
        <div className="card">
          <h2 className="card-title mb-4">{editing.id ? "Editar plano" : "Novo plano"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {input("Nome do plano", "name")}
            {input("Código (único)", "code")}
            {input("Valor de ativação (centavos, ex: 10000 = R$100)", "activation_price_cents", "number")}
            {input("Valor mensal (centavos)", "monthly_price_cents", "number")}
            <div>
              <label className="label">Período</label>
              <select
                className="input"
                value={editing.billing_interval}
                onChange={(e) => setEditing({ ...editing, billing_interval: e.target.value })}
              >
                <option value="month">Mensal</option>
                <option value="year">Anual</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" className="w-4 h-4 accent-[#1d5c3a]" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Plano ativo (visível para assinatura)
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Descrição</label>
              <textarea className="input min-h-20" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
          </div>
          {msg && <p className="mt-4 text-sm text-gray-600">{msg}</p>}
          <div className="mt-5 flex gap-3">
            <button className="btn btn-primary" onClick={save} disabled={saving || !editing.name || !editing.code}>
              {saving ? "Salvando..." : "Salvar plano"}
            </button>
            <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
