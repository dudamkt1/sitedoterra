"use client";

import { useEffect, useState } from "react";

interface PromptDef {
  id: string;
  category: string;
  title: string;
  prompt: string;
}

const PROMPTS: PromptDef[] = [
  {
    id: "legenda-instagram",
    category: "Redes sociais",
    title: "Criar legenda para Instagram",
    prompt:
      "Você é um estrategista de conteúdo para uma consultora doTERRA. Crie uma legenda para Instagram sobre [PRODUTO/TEMA]. Inclua um gancho no início, texto envolvente, CTA e 8 hashtags. Use linguagem comercial/educativa responsável, sem promessas médicas. Português do Brasil.",
  },
  {
    id: "roteiro-reel",
    category: "Redes sociais",
    title: "Criar roteiro de Reel",
    prompt:
      "Crie um roteiro de Reel de até 30 segundos para uma consultora doTERRA sobre [PRODUTO/TEMA]. Divida em: abertura (gancho), desenvolvimento (3 cenas com falas), CTA final e sugestão de trilha/legenda. Tom leve e didático, sem promessas médicas.",
  },
  {
    id: "carrossel",
    category: "Redes sociais",
    title: "Criar carrossel educativo",
    prompt:
      "Crie um carrossel educativo de 5 a 8 slides sobre [TEMA] para o Instagram de uma consultora doTERRA. Para cada slide, informe o texto curto e a sugestão de imagem/visual. Inclua título, capa e último slide com CTA. Conteúdo responsável, sem alegações médicas.",
  },
  {
    id: "descricao-produto",
    category: "Produtos",
    title: "Criar descrição de produto",
    prompt:
      "Escreva a descrição completa do produto doTERRA [PRODUTO]. Inclua: título, descrição curta, descrição longa, destaques, CTA, SEO title (60 caracteres), meta description (155) e palavras-chave. NÃO invente propriedades, composição ou benefícios médicos — use apenas as informações que eu fornecer.",
  },
  {
    id: "anuncio",
    category: "Marketing",
    title: "Criar anúncio",
    prompt:
      "Crie um anúncio de alta conversão para [CANAL] sobre [PRODUTO/OFERTA]. Inclua headline, texto principal, CTA, versão curta e versão longa, e 2 variações para teste A/B. Sem promessas de cura ou alegações médicas.",
  },
  {
    id: "calendario",
    category: "Planejamento",
    title: "Criar calendário de conteúdo",
    prompt:
      "Monte um calendário de conteúdo de [7/15/30] dias para as redes sociais de uma consultora doTERRA. Para cada dia: tema, formato (post/story/reel), ideia, gancho, CTA e hashtags. Alterne conteúdo educativo e comercial.",
  },
  {
    id: "stories",
    category: "Redes sociais",
    title: "Criar ideias para Stories",
    prompt:
      "Gere 10 ideias de Stories para uma consultora doTERRA sobre [TEMA]. Para cada ideia: objetivo, texto da tela, enquete/atalho sugerido e CTA. Conteúdo leve e responsável.",
  },
  {
    id: "titulos",
    category: "Conteúdo",
    title: "Criar títulos",
    prompt:
      "Crie 5 opções de título para um conteúdo sobre [PRODUTO/TEMA] no tom [TOM]. Cada título em uma linha, numerado. Sem explicações. Português do Brasil.",
  },
];

const FAVORITES_KEY = "doterra-ai-prompt-favorites";

export function AiPromptsPanel() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<PromptDef | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, []);

  function persist(next: string[]) {
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  }

  function toggleFav(id: string) {
    persist(favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]);
  }

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* noop */
    }
  }

  const categories = Array.from(new Set(PROMPTS.map((p) => p.category)));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="card-title mb-1">Central de Prompts</h2>
        <span className="badge badge-blue">Funciona sem chave</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Prompts prontos para copiar e usar em qualquer IA gratuita que você já conhece (ChatGPT, Google Gemini,
        Microsoft Copilot, Groq e outros). Substitua os campos entre colchetes — como <code className="bg-gray-100 px-1 rounded">[PRODUTO]</code> — pelo seu assunto e cole na ferramenta de IA.
      </p>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="card-title">Editar prompt — {editing.title}</h3>
              <button className="text-gray-400 text-xl" onClick={() => setEditing(null)}>✕</button>
            </div>
            <textarea className="input min-h-48 font-mono text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => copy(draft, editing.id)}>Copiar editado</button>
            </div>
          </div>
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat} className="mb-5 last:mb-0">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">{cat}</p>
          <div className="space-y-2">
            {PROMPTS.filter((p) => p.category === cat).map((p) => {
              const isFav = favorites.includes(p.id);
              return (
                <div key={p.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-700">{p.title}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleFav(p.id)}
                        className={`text-lg ${isFav ? "text-amber-400" : "text-gray-300 hover:text-amber-400"}`}
                        title={isFav ? "Remover favorito" : "Salvar favorito"}
                      >
                        {isFav ? "★" : "☆"}
                      </button>
                      <button className="btn btn-outline !py-1 !px-2 !text-xs" onClick={() => { setEditing(p); setDraft(p.prompt); }}>Editar</button>
                      <button className="btn btn-primary !py-1 !px-3 !text-xs" onClick={() => copy(p.prompt, p.id)}>
                        {copied === p.id ? "✓ Copiado!" : "Copiar"}
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap text-gray-600 bg-white rounded-lg p-3 border border-gray-100 max-h-40 overflow-y-auto">{p.prompt}</pre>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {favorites.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">⭐ {favorites.length} prompt(s) favorito(s) salvos neste navegador.</p>
      )}
    </div>
  );
}