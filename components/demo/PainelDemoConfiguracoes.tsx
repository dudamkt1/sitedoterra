"use client";

import { useDemoStore } from "@/lib/demo/store";

const ALL_MODULES: Array<{ key: string; label: string; defaultEnabled: boolean }> = [
  { key: "clients", label: "Clientes", defaultEnabled: true },
  { key: "products", label: "Produtos", defaultEnabled: true },
  { key: "sales", label: "Vendas", defaultEnabled: true },
  { key: "charges", label: "Cobranças", defaultEnabled: true },
  { key: "tasks", label: "Tarefas", defaultEnabled: true },
  { key: "whatsapp", label: "WhatsApp", defaultEnabled: true },
  { key: "finance", label: "Financeiro", defaultEnabled: true },
  { key: "loyalty", label: "Fidelidade", defaultEnabled: true },
  { key: "reports", label: "Relatórios", defaultEnabled: true },
  { key: "messages", label: "Mensagens automáticas", defaultEnabled: false },
];

export function PainelDemoConfiguracoes() {
  const { ready, data, update, reset, clearAll } = useDemoStore();
  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  function toggleModule(key: string) {
    update((d) => ({
      ...d,
      crmSettings: {
        ...d.crmSettings,
        modules: { ...d.crmSettings.modules, [key]: !d.crmSettings.modules[key] },
      },
    }));
  }

  function handleReset() {
    if (
      !confirm(
        "Restaurar demonstração?\n\nIsso apagará somente suas alterações neste dispositivo e restaurará o ambiente de demonstração."
      )
    ) {
      return;
    }
    reset();
  }

  function handleClearAll() {
    if (
      !confirm(
        "Apagar TODOS os dados da demonstração deste navegador?"
      )
    ) {
      return;
    }
    clearAll();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Configurações do CRM</h1>
        <p className="text-sm text-gray-500 mt-1">Ative ou desative módulos da demonstração.</p>
      </div>

      <div className="card mb-6">
        <h2 className="card-title mb-3">Módulos disponíveis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALL_MODULES.map((m) => {
            const enabled = data.crmSettings.modules[m.key] ?? m.defaultEnabled;
            return (
              <label
                key={m.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <span className="font-medium text-gray-700">{m.label}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#1d5c3a]"
                  checked={Boolean(enabled)}
                  onChange={() => toggleModule(m.key)}
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="card border-amber-300 bg-amber-50/40">
        <h2 className="card-title mb-2">Restaurar demonstração</h2>
        <p className="text-sm text-gray-600 mb-4">
          Apaga todas as alterações feitas neste dispositivo e restaura o ambiente de demonstração ao estado inicial.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-[#1d5c3a] bg-white px-4 py-2 text-sm font-semibold text-[#1d5c3a] hover:bg-[#e5f4ea]"
          >
            ♻️ Restaurar demonstração
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            🗑️ Apagar tudo deste navegador
          </button>
        </div>
      </div>
    </div>
  );
}
