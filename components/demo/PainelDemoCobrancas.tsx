"use client";

import { useDemoStore } from "@/lib/demo/store";
import { formatBRL } from "@/lib/utils";

export function PainelDemoCobrancas() {
  const { ready, data, update, genId } = useDemoStore();
  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  function addCharge() {
    const clientName = prompt("Nome do cliente:");
    if (!clientName) return;
    let client = data!.clients.find((c) => c.name === clientName);
    if (!client) {
      client = {
        id: genId("cli"),
        name: clientName,
        email: "",
        phone: "",
        city: "",
        vip: false,
        loyaltyPoints: 0,
        notes: "",
        createdAt: new Date().toISOString(),
      };
    }
    const desc = prompt("Descrição da cobrança:") || "Cobrança";
    const amountStr = prompt("Valor (em reais):");
    const amount = Number(amountStr) || 0;
    update((d) => ({
      ...d,
      clients: client && !d.clients.find((c) => c.id === client!.id) ? [...d.clients, client] : d.clients,
      charges: [
        ...d.charges,
        {
          id: genId("chg"),
          clientId: client!.id,
          description: desc,
          amount,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          status: "pendente",
        },
      ],
    }));
  }

  function markPaid(id: string) {
    update((d) => ({
      ...d,
      charges: d.charges.map((c) => (c.id === id ? { ...c, status: "pago" } : c)),
    }));
  }

  function removeCharge(id: string) {
    if (!confirm("Excluir cobrança?")) return;
    update((d) => ({ ...d, charges: d.charges.filter((c) => c.id !== id) }));
  }

  const pendente = data.charges.filter((c) => c.status !== "pago").reduce((a, c) => a + c.amount, 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Cobranças</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pendente: <strong className="text-amber-700">{formatBRL(pendente * 100)}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={addCharge}
          className="rounded-lg bg-[#1d5c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16472c]"
        >
          + Nova cobrança
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-left">Vencimento</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.charges.map((c) => {
              const cli = data.clients.find((x) => x.id === c.clientId);
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{cli?.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.description}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(c.dueDate).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatBRL(c.amount * 100)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        c.status === "pago"
                          ? "bg-emerald-100 text-emerald-800"
                          : c.status === "pendente"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status !== "pago" && (
                      <button type="button" onClick={() => markPaid(c.id)} className="text-xs font-medium text-emerald-700 hover:underline mr-3">
                        Marcar pago
                      </button>
                    )}
                    <button type="button" onClick={() => removeCharge(c.id)} className="text-xs font-medium text-red-600 hover:underline">
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
