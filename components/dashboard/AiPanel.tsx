"use client";

import { useEffect, useState } from "react";
import type { AiProvider } from "@/types";
import { AiConfig } from "@/components/dashboard/AiConfig";
import { AiTools } from "@/components/dashboard/AiTools";

const GUIDE_STEPS = [
  "Escolha um provedor (recomendado: Google Gemini — plano gratuito).",
  "Crie sua conta no site do provedor.",
  "Crie sua API Key no painel do provedor.",
  "Copie a chave gerada.",
  "Cole a chave no campo acima e clique em Salvar.",
  "Clique em Testar conexão para confirmar.",
  "Use a IA no seu painel para gerar conteúdo.",
];

export function AiPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [data, setData] = useState<{ settings: { provider_id: string | null; has_key: boolean; key_hint: string | null }; providers: AiProvider[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/ai/settings");
    const json = await res.json();
    if (res.ok) setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p className="text-sm text-gray-400">Carregando...</p>;

  const providers = data?.providers || [];
  const settings = data?.settings || { provider_id: null, has_key: false, key_hint: null };
  const hasKey = settings.has_key;

  return (
    <div className="space-y-6">
      {message && (
        <p className={`rounded-lg px-4 py-3 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{message.text}</p>
      )}

      <AiConfig settings={settings} providers={providers} onSaved={() => setMessage({ ok: true, text: "Configuração salva. Agora teste a conexão." })} />

      <AiTools onError={(t) => setMessage(t ? { ok: false, text: t } : null)} />

      <div className="card">
        <h2 className="card-title mb-1">Como configurar uma IA gratuita</h2>
        <p className="text-sm text-gray-500 mb-3">
          {providers[0]?.instructions || "Siga os passos abaixo. Os limites variam por provedor — consulte a documentação para detalhes."}
        </p>
        <ol className="space-y-2">
          {GUIDE_STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
              <span className="badge badge-green shrink-0 mt-0.5">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {!hasKey && (
          <p className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Você ainda não configurou uma API Key. Configure em <strong>Configurar provedor de IA</strong> acima para liberar as ferramentas.
          </p>
        )}
        {isSuperAdmin && (
          <p className="mt-3 text-xs text-gray-400">
            Dica: como Super Admin você pode controlar provedores, documentação e limites em /admin/editor-ia.
          </p>
        )}
      </div>
    </div>
  );
}
