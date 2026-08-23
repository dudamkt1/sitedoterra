"use client";

import Link from "next/link";
import { useDemoStore } from "@/lib/demo/store";
import { formatBRL } from "@/lib/utils";

export function PainelDemoClienteDetalhe({ clientId }: { clientId: string }) {
  const { ready, data, update } = useDemoStore();
  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  const client = data.clients.find((c) => c.id === clientId);
  if (!client) {
    return (
      <div>
        <Link href="/painel/crm/clientes" className="text-sm text-[#1d5c3a] hover:underline">← Voltar</Link>
        <p className="mt-4 text-sm text-gray-500">Cliente não encontrado.</p>
      </div>
    );
  }

  const sales = data.sales.filter((s) => s.clientId === client.id);
  const charges = data.charges.filter((c) => c.clientId === client.id);
  const tasks = data.tasks.filter((t) => t.clientId === client.id);
  const messages = data.whatsapp.filter((m) => m.clientId === client.id);

  function toggleVip() {
    if (!client) return;
    update((d) => ({
      ...d,
      clients: d.clients.map((c) => (c.id === client.id ? { ...c, vip: !c.vip } : c)),
    }));
  }

  function addNotes(text: string) {
    if (!client) return;
    update((d) => ({
      ...d,
      clients: d.clients.map((c) => (c.id === client.id ? { ...c, notes: text } : c)),
    }));
  }

  function editNotes() {
    if (!client) return;
    const t = prompt("Anotações:", client.notes);
    if (t !== null) addNotes(t);
  }

  return (
    <div>
      <Link href="/painel/crm/clientes" className="text-sm text-[#1d5c3a] hover:underline">← Voltar para clientes</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{client.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {client.email || "—"} · {client.phone || "—"} · {client.city || "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleVip}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              client.vip ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-300 text-gray-700"
            }`}
          >
            {client.vip ? "⭐ VIP" : "Tornar VIP"}
          </button>
          <button
            type="button"
            onClick={editNotes}
            className="rounded-lg border border-[#1d5c3a] px-3 py-1.5 text-sm font-semibold text-[#1d5c3a] hover:bg-[#e5f4ea]"
          >
            Editar anotações
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Pontos" value={String(client.loyaltyPoints)} />
        <Stat label="Vendas" value={String(sales.length)} />
        <Stat label="Cobranças" value={String(charges.length)} />
        <Stat label="Tarefas" value={String(tasks.length)} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="card-title mb-3">Anotações</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes || "Sem anotações."}</p>
        </div>

        <div className="card">
          <h2 className="card-title mb-3">Histórico de vendas</h2>
          {sales.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma venda registrada.</p>
          ) : (
            <ul className="space-y-2">
              {sales.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div>
                    <p className="font-medium text-gray-800">{formatBRL(s.total * 100)}</p>
                    <p className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleDateString("pt-BR")} · {s.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="card-title mb-3">Cobranças</h2>
          {charges.length === 0 ? (
            <p className="text-sm text-gray-500">Sem cobranças.</p>
          ) : (
            <ul className="space-y-2">
              {charges.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div>
                    <p className="font-medium text-gray-800">{c.description}</p>
                    <p className="text-xs text-gray-500">Vencimento: {new Date(c.dueDate).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{formatBRL(c.amount * 100)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="card-title mb-3">Tarefas</h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-500">Sem tarefas para este cliente.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div>
                    <p className={`font-medium ${t.done ? "line-through text-gray-400" : "text-gray-800"}`}>{t.title}</p>
                    <p className="text-xs text-gray-500">{new Date(t.dueDate).toLocaleDateString("pt-BR")} · {t.priority}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card lg:col-span-2">
          <h2 className="card-title mb-3">Conversas (WhatsApp)</h2>
          {messages.length === 0 ? (
            <p className="text-sm text-gray-500">Sem mensagens trocadas.</p>
          ) : (
            <ul className="space-y-2">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.direction === "out" ? "bg-[#e5f4ea] text-[#1d5c3a]" : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <p>{m.content}</p>
                  <p className={`text-[0.65rem] mt-1 ${m.direction === "out" ? "text-emerald-700" : "text-gray-500"}`}>
                    {new Date(m.createdAt).toLocaleString("pt-BR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-[0.65rem] uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-800 mt-1">{value}</p>
    </div>
  );
}
