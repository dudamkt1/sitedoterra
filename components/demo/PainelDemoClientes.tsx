"use client";

import { useDemoStore } from "@/lib/demo/store";

export function PainelDemoClientes() {
  const { ready, data, update, genId } = useDemoStore();

  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  function addClient() {
    const name = prompt("Nome do cliente:");
    if (!name) return;
    const email = prompt("E-mail:") || "";
    const phone = prompt("Telefone:") || "";
    update((d) => ({
      ...d,
      clients: [
        ...d.clients,
        {
          id: genId("cli"),
          name,
          email,
          phone,
          city: "",
          vip: false,
          loyaltyPoints: 0,
          notes: "",
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  }

  function editClient(id: string) {
    const c = data!.clients.find((x) => x.id === id);
    if (!c) return;
    const name = prompt("Nome:", c.name);
    if (!name) return;
    const email = prompt("E-mail:", c.email) || "";
    const phone = prompt("Telefone:", c.phone) || "";
    update((d) => ({
      ...d,
      clients: d.clients.map((x) =>
        x.id === id ? { ...x, name, email, phone } : x
      ),
    }));
  }

  function toggleVip(id: string) {
    update((d) => ({
      ...d,
      clients: d.clients.map((x) =>
        x.id === id ? { ...x, vip: !x.vip } : x
      ),
    }));
  }

  function removeClient(id: string) {
    if (!confirm("Excluir cliente?")) return;
    update((d) => ({
      ...d,
      clients: d.clients.filter((x) => x.id !== id),
    }));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.clients.length} cliente(s) cadastrado(s) (somente neste dispositivo).
          </p>
        </div>
        <button
          type="button"
          onClick={addClient}
          className="rounded-lg bg-[#1d5c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16472c]"
        >
          + Novo cliente
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Contato</th>
              <th className="px-4 py-3 text-left">VIP</th>
              <th className="px-4 py-3 text-right">Pontos</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.clients.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  <div>{c.email || "—"}</div>
                  <div className="text-xs text-gray-400">{c.phone || "—"}</div>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleVip(c.id)}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      c.vip ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {c.vip ? "⭐ VIP" : "tornar VIP"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">{c.loyaltyPoints}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => editClient(c.id)} className="text-xs font-medium text-[#1d5c3a] hover:underline mr-3">
                    Editar
                  </button>
                  <button type="button" onClick={() => removeClient(c.id)} className="text-xs font-medium text-red-600 hover:underline">
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
