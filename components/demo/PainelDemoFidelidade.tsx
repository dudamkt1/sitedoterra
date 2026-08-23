"use client";

import { useDemoStore } from "@/lib/demo/store";

export function PainelDemoFidelidade() {
  const { ready, data, update } = useDemoStore();
  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  const cfg = data.crmSettings.loyalty;
  const vips = data.clients.filter((c) => c.vip);
  const ranking = [...data.clients].sort((a, b) => b.loyaltyPoints - a.loyaltyPoints);

  function addPoints(id: string) {
    const pts = Number(prompt("Adicionar quantos pontos?", "50"));
    if (!pts) return;
    update((d) => ({
      ...d,
      clients: d.clients.map((c) =>
        c.id === id ? { ...c, loyaltyPoints: c.loyaltyPoints + pts, vip: c.loyaltyPoints + pts >= cfg.vipThreshold } : c
      ),
    }));
  }

  function setCfg(field: "pointsPerCurrency" | "currencyPerPoint" | "vipThreshold", value: number) {
    update((d) => ({
      ...d,
      crmSettings: { ...d.crmSettings, loyalty: { ...d.crmSettings.loyalty, [field]: value } },
    }));
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Programa de Fidelidade</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie pontos, recompensas e clientes VIP.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="card-title mb-3">Regras</h2>
          <div className="space-y-3">
            <NumberField
              label="Pontos por R$ 1 gasto"
              value={cfg.pointsPerCurrency}
              onChange={(v) => setCfg("pointsPerCurrency", v)}
            />
            <NumberField
              label="Valor em R$ por ponto resgatado"
              value={cfg.currencyPerPoint}
              step={0.01}
              onChange={(v) => setCfg("currencyPerPoint", v)}
            />
            <NumberField
              label="Pontos para tornar-se VIP"
              value={cfg.vipThreshold}
              onChange={(v) => setCfg("vipThreshold", v)}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="card-title mb-3">Clientes VIP</h2>
          {vips.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum cliente VIP ainda.</p>
          ) : (
            <ul className="space-y-2">
              {vips.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="font-medium text-amber-900">⭐ {c.name}</span>
                  <span className="text-xs text-amber-700">{c.loyaltyPoints} pts</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title mb-3">Ranking de pontos</h2>
        <ol className="space-y-2">
          {ranking.map((c, idx) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-400 w-6">#{idx + 1}</span>
                <span className="font-medium text-gray-800">{c.name}</span>
                {c.vip && <span className="text-xs font-semibold text-amber-700">⭐ VIP</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">{c.loyaltyPoints} pts</span>
                <button
                  type="button"
                  onClick={() => addPoints(c.id)}
                  className="rounded-md border border-[#1d5c3a] px-2 py-1 text-xs font-semibold text-[#1d5c3a] hover:bg-[#e5f4ea]"
                >
                  + Pontos
                </button>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        step={step}
        className="input"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
