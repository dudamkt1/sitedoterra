"use client";

import { useState } from "react";

interface ToolDef {
  id: string;
  label: string;
  emoji: string;
  kind: string;
  prompt: string;
}

const TOOLS: ToolDef[] = [
  { id: "title", label: "Gerar título", emoji: "✍️", kind: "title", prompt: "Crie um título curto e elegante (máx. 6 palavras) para uma página de bem-estar e óleos essenciais." },
  { id: "description", label: "Gerar descrição", emoji: "📝", kind: "description", prompt: "Escreva uma descrição convincente (2 a 3 frases) com tom elegante e profissional para um site de bem-estar." },
  { id: "post", label: "Post para redes sociais", emoji: "📱", kind: "post", prompt: "Crie um post para Instagram/Facebook sobre bem-estar com óleos essenciais, incluindo hashtags." },
  { id: "faq", label: "Gerar FAQ", emoji: "❓", kind: "faq", prompt: "Gere 3 perguntas frequentes com respostas sobre óleos essenciais e bem-estar, no formato Pergunta: ... Resposta: ..." },
  { id: "product", label: "Descrição de produto", emoji: "🛍️", kind: "post", prompt: "Escreva uma descrição curta e persuasiva de um óleo essencial para uma vitrine de produtos." },
  { id: "ad", label: "Anúncio", emoji: "📢", kind: "post", prompt: "Crie um anúncio curto e chamativo (2 frases + CTA) para atrair clientes para consulta de bem-estar." },
  { id: "social-ideas", label: "Ideias de conteúdo", emoji: "💡", kind: "post", prompt: "Liste 5 ideias de conteúdo para redes sociais sobre rotinas de bem-estar e óleos essenciais." },
  { id: "client-reply", label: "Resposta para cliente", emoji: "💬", kind: "default", prompt: "Escreva uma resposta educada e acolhedora para uma cliente que pergunta como começar com óleos essenciais." },
];

export function AiTools({ onError }: { onError: (text: string) => void }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [result, setResult] = useState<{ tool: ToolDef; text: string } | null>(null);
  const [draft, setDraft] = useState("");

  async function generate(tool: ToolDef) {
    setGenerating(tool.id);
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: tool.kind, prompt: tool.prompt }),
    });
    const json = await res.json();
    setGenerating(null);
    if (!res.ok) {
      onError(json.error || "Erro ao gerar conteúdo. Configure sua IA primeiro.");
      return;
    }
    setResult({ tool, text: json.text });
    setDraft(json.text);
  }

  function copyResult() {
    navigator.clipboard?.writeText(draft).catch(() => {});
    onError("");
    setResult(null);
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="card-title mb-1">Ferramentas de IA</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Gere títulos, textos, posts, FAQ, anúncios e muito mais. As sugestões aparecem para você revisar antes de usar.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className="rounded-xl border border-gray-100 bg-gray-50 hover:border-[#1d5c3a] hover:bg-[#e5f4ea] transition-colors p-4 text-left"
            onClick={() => generate(tool)}
            disabled={generating !== null}
          >
            <div className="text-2xl mb-2">{tool.emoji}</div>
            <div className="text-sm font-medium text-gray-700">{tool.label}</div>
            {generating === tool.id && <div className="text-xs text-[#1d5c3a] mt-1">Gerando...</div>}
          </button>
        ))}
      </div>

      {result && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="card-title">{result.tool.emoji} {result.tool.label}</h3>
              <button className="text-gray-400 text-xl" onClick={() => setResult(null)}>✕</button>
            </div>
            <textarea className="input min-h-40" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <p className="text-xs text-gray-400 mt-2">Edite antes de usar. A sugestão nunca é aplicada automaticamente.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn btn-outline" onClick={() => setResult(null)}>Descartar</button>
              <button className="btn btn-primary" onClick={copyResult}>Aceitar e copiar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
