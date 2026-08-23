"use client";

import { useState } from "react";
import { SectionTitle } from "@/components/dashboard/ui";

const SUGGESTIONS = [
  "Post para Instagram sobre os benefícios do óleo de Lavanda",
  "Mensagem de boas-vindas para novos clientes doTERRA",
  "Descrição de venda para o blend On Guard",
  "E-mail de reativação para clientes inativos há 60 dias",
  "Story destacando o uso do Deep Relief para atletas",
];

const MOCK_RESPONSES: Record<string, string> = {
  default: "Aqui está uma sugestão criada com base no universo doTERRA para você adaptar como quiser:\n\n\"Acorde com mais leveza e disposição. O blend Lemon + Lavanda é a combinação perfeita para começar o dia com o pé direito — algumas gotas no difusor enquanto você prepara o café já transformam a energia da casa. Você já experimentou? Conta nos comentários! 💛✨\"\n\n#doTERRA #OleosEssenciais #BemEstarNatural",
};

export function PainelDemoIa() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function generate(text: string) {
    setLoading(true);
    setResponse(null);
    setTimeout(() => {
      setResponse(
        MOCK_RESPONSES[text.toLowerCase().slice(0, 12)] || MOCK_RESPONSES.default
      );
      setLoading(false);
    }, 900);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    generate(prompt);
  }

  return (
    <div className="space-y-6">
      <SectionTitle sub="Demonstração da central de IA para conteúdo doTERRA. As respostas aqui são simuladas e ficam somente neste dispositivo.">
        Central de IA para Conteúdo
      </SectionTitle>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label" htmlFor="prompt">O que você quer criar?</label>
            <textarea
              id="prompt"
              className="input min-h-[100px]"
              placeholder="Ex.: post sobre óleos cítricos para o Instagram"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="rounded-lg bg-[#1d5c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16472c] disabled:opacity-50"
          >
            {loading ? "Gerando..." : "✨ Gerar conteúdo"}
          </button>
        </form>
      </div>

      {response && (
        <div className="card border-emerald-300 bg-emerald-50/40">
          <h2 className="card-title mb-2">Sugestão da IA</h2>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{response}</p>
        </div>
      )}

      <div className="card">
        <h2 className="card-title mb-3">Sugestões rápidas</h2>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setPrompt(s);
                generate(s);
              }}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card border-amber-300 bg-amber-50/40">
        <p className="text-xs text-amber-900">
          Em produção, esta ferramenta integra com provedores de IA configuráveis pelo painel. Aqui ela usa
          respostas de demonstração para mostrar a experiência ao visitante — nada é enviado para APIs externas.
        </p>
      </div>
    </div>
  );
}
