"use client";

import { useDemoStore } from "@/lib/demo/store";
import { formatBRL } from "@/lib/utils";

export function PainelDemoFinanceiro() {
  const { ready, data, update, genId } = useDemoStore();
  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  function addEntry() {
    const type = (prompt("Tipo (receita/despesa):", "receita") || "receita") as "receita" | "despesa";
    const desc = prompt("Descrição:");
    if (!desc) return;
    const amountStr = prompt("Valor (em reais):");
    const amount = Number(amountStr) || 0;
    update((d) => ({
      ...d,
      finance: [
        ...d.finance,
        { id: genId("fin"), type, description: desc, amount, date: new Date().toISOString() },
      ],
    }));
  }

  function remove(id: string) {
    if (!confirm("Excluir lançamento?")) return;
    update((d) => ({ ...d, finance: d.finance.filter((f) => f.id !== id) }));
  }

  const receita = data.finance.filter((f) => f.type === "receita").reduce((a, f) => a + f.amount, 0);
  const despesa = data.finance.filter((f) => f.type === "despesa").reduce((a, f) => a + f.amount, 0);
  const saldo = receita - despesa;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Financeiro</h1>
          <p className="text-sm text-gray-500 mt-1">
            Receitas: <strong className="text-emerald-700">{formatBRL(receita * 100)}</strong> · Despesas:{" "}
            <strong className="text-rose-700">{formatBRL(despesa * 100)}</strong> · Saldo:{" "}
            <strong className={saldo >= 0 ? "text-emerald-700" : "text-rose-700"}>{formatBRL(saldo * 100)}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={addEntry}
          className="rounded-lg bg-[#1d5c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16472c]"
        >
          + Novo lançamento
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.finance.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-3 text-gray-600">{new Date(f.date).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{f.description}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    f.type === "receita" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    {f.type}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${f.type === "receita" ? "text-emerald-700" : "text-rose-700"}`}>
                  {f.type === "despesa" ? "-" : "+"}{formatBRL(f.amount * 100)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => remove(f.id)} className="text-xs font-medium text-red-600 hover:underline">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
