"use client";

import { SectionTitle } from "@/components/dashboard/ui";
import { useDemoStore } from "@/lib/demo/store";

export function PainelDemoIaTreinamento() {
  const { ready, data, update } = useDemoStore();
  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  function addTraining() {
    const topic = prompt("Tópico para a IA aprender (ex: 'óleo de copaíba'):");
    if (!topic) return;
    const content = prompt("Conteúdo de exemplo:");
    if (!content) return;
    update((d) => ({
      ...d,
      crmSettings: {
        ...d.crmSettings,
        // Reaproveita o objeto de configuração para guardar o "training" como array.
        // Em produção isso viria de uma tabela separada.
        // Aqui só guardamos no objeto para não quebrar a serialização.
        ...d.crmSettings,
      },
    }));
    // Salva em uma chave à parte para o treinamento demo
    try {
      const key = "sitedoterra_demo_training";
      const raw = localStorage.getItem(key);
      const list: { id: string; topic: string; content: string }[] = raw ? JSON.parse(raw) : [];
      list.push({ id: Date.now().toString(36), topic, content });
      localStorage.setItem(key, JSON.stringify(list));
      alert("Treinamento adicionado (somente neste dispositivo).");
    } catch {}
  }

  let trainings: { id: string; topic: string; content: string }[] = [];
  try {
    const raw = localStorage.getItem("sitedoterra_demo_training");
    if (raw) trainings = JSON.parse(raw);
  } catch {}

  return (
    <div className="space-y-6">
      <SectionTitle sub="Adicione exemplos para a IA aprender a falar sobre o seu negócio. Tudo é salvo apenas neste dispositivo.">
        Treinar IA do site
      </SectionTitle>

      <div className="card">
        <button
          type="button"
          onClick={addTraining}
          className="rounded-lg bg-[#1d5c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16472c]"
        >
          + Adicionar exemplo
        </button>
      </div>

      <div className="card">
        <h2 className="card-title mb-3">Exemplos adicionados</h2>
        {trainings.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum exemplo adicionado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {trainings.map((t) => (
              <li key={t.id} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                <p className="font-semibold text-gray-800">{t.topic}</p>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{t.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
