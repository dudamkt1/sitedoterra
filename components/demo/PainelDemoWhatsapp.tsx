"use client";

import { useDemoStore } from "@/lib/demo/store";
import { useState } from "react";

export function PainelDemoWhatsapp() {
  const { ready, data, update, genId } = useDemoStore();
  const [selected, setSelected] = useState<string | null>(null);
  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  const client = data.clients.find((c) => c.id === selected) || data.clients[0];

  function send(text: string) {
    if (!client) return;
    update((d) => ({
      ...d,
      whatsapp: [
        ...d.whatsapp,
        {
          id: genId("wpp"),
          clientId: client.id,
          direction: "out",
          content: text,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  }

  function handleSend() {
    const text = prompt("Mensagem para " + client?.name + ":");
    if (text) send(text);
  }

  const messages = client
    ? data.whatsapp.filter((m) => m.clientId === client.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-1">Demonstração do módulo de conversas. Nada é enviado para a API do WhatsApp.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[500px]">
        <div className="rounded-xl border border-gray-200 bg-white overflow-y-auto">
          <p className="border-b px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-500">Conversas</p>
          <ul>
            {data.clients.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${
                    client?.id === c.id ? "bg-[#e5f4ea]" : ""
                  }`}
                >
                  <p className="font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {data.whatsapp.filter((m) => m.clientId === c.id).slice(-1)[0]?.content || "Sem mensagens"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2 flex flex-col rounded-xl border border-gray-200 bg-white">
          {client ? (
            <>
              <div className="border-b px-4 py-3">
                <p className="font-semibold text-gray-800">{client.name}</p>
                <p className="text-xs text-gray-500">{client.phone || "—"}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        m.direction === "out"
                          ? "bg-[#1d5c3a] text-white"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {m.content}
                      <p className={`text-[0.6rem] mt-1 ${m.direction === "out" ? "text-emerald-100" : "text-gray-400"}`}>
                        {new Date(m.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t p-3">
                <button
                  type="button"
                  onClick={handleSend}
                  className="w-full rounded-lg bg-[#1d5c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16472c]"
                >
                  ✉️ Enviar mensagem
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
              Selecione uma conversa
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
