"use client";

import { useDemoStore } from "@/lib/demo/store";
import { formatBRL } from "@/lib/utils";

export function PainelDemoVendas() {
  const { ready, data, update, genId } = useDemoStore();
  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  function addSale() {
    const clientName = prompt("Nome do cliente (use um cliente existente ou crie um novo):");
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
    const totalStr = prompt("Total da venda (em reais):");
    const total = Number(totalStr) || 0;
    update((d) => ({
      ...d,
      clients: client && !d.clients.find((c) => c.id === client!.id) ? [...d.clients, client] : d.clients,
      sales: [
        ...d.sales,
        {
          id: genId("sale"),
          clientId: client!.id,
          productIds: [],
          total,
          status: "pago",
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  }

  function changeStatus(id: string) {
    const s = data!.sales.find((x) => x.id === id);
    if (!s) return;
    const next = s.status === "pago" ? "pendente" : s.status === "pendente" ? "cancelado" : "pago";
    update((d) => ({
      ...d,
      sales: d.sales.map((x) => (x.id === id ? { ...x, status: next as typeof x.status } : x)),
    }));
  }

  function removeSale(id: string) {
    if (!confirm("Excluir venda?")) return;
    update((d) => ({ ...d, sales: d.sales.filter((x) => x.id !== id) }));
  }

  const total = data.sales.reduce((a, s) => a + s.total, 0);
  const pago = data.sales.filter((s) => s.status === "pago").reduce((a, s) => a + s.total, 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Vendas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Total: {formatBRL(total * 100)} · Recebido: {formatBRL(pago * 100)}
          </p>
        </div>
        <button
          type="button"
          onClick={addSale}
          className="rounded-lg bg-[#1d5c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16472c]"
        >
          + Nova venda
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.sales.map((s) => {
              const client = data.clients.find((c) => c.id === s.clientId);
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{client?.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(s.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatBRL(s.total * 100)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        s.status === "pago"
                          ? "bg-emerald-100 text-emerald-800"
                          : s.status === "pendente"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => changeStatus(s.id)} className="text-xs font-medium text-[#1d5c3a] hover:underline mr-3">
                      Alternar status
                    </button>
                    <button type="button" onClick={() => removeSale(s.id)} className="text-xs font-medium text-red-600 hover:underline">
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
