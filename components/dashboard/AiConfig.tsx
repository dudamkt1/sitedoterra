"use client";

import { useState } from "react";
import type { AiProvider } from "@/types";

interface AiConfigProps {
  settings: { provider_id: string | null; has_key: boolean; key_hint: string | null };
  providers: AiProvider[];
  onSaved: () => void;
}

export function AiConfig({ settings, providers, onSaved }: AiConfigProps) {
  const [providerId, setProviderId] = useState(settings?.provider_id || "");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const selectedProvider = providers.find((p) => p.id === providerId);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/ai/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: providerId, api_key: apiKey }),
    });
    const json = await res.json();
    if (res.ok) {
      setApiKey("");
      setMessage({ ok: true, text: "Configuração salva com sucesso." });
      onSaved();
    } else {
      setMessage({ ok: false, text: json.error || "Erro ao salvar." });
    }
    setSaving(false);
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: providerId }),
    });
    const json = await res.json();
    setTestResult({ ok: json.ok, text: json.message || "Sem resposta do provedor." });
    setTesting(false);
  }

  return (
    <div className="card">
      <h2 className="card-title mb-1">Configurar provedor de IA</h2>
      <p className="text-sm text-gray-500 mb-4">
        Você pode utilizar uma API com plano gratuito. Cada provedor possui seus próprios limites. Sua chave fica armazenada com segurança no servidor.
      </p>

      {message && (
        <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{message.text}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Provedor de IA</label>
          <select className="input" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            <option value="">Selecione um provedor</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selectedProvider && (
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              <p><strong className="text-gray-700">Plano gratuito:</strong> {selectedProvider.free_tier || "—"}</p>
              <p><strong className="text-gray-700">Limites:</strong> {selectedProvider.limits || "—"}</p>
              {selectedProvider.docs_url && (
                <p><a href={selectedProvider.docs_url} target="_blank" className="text-[#1d5c3a] underline">Como obter a API Key ↗</a></p>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="label">API Key</label>
          <input
            type="password"
            className="input"
            placeholder={settings?.has_key ? `${settings.key_hint} — deixe em branco para manter` : "Cole sua API Key aqui"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {settings?.has_key && <p className="text-xs text-gray-400 mt-1">Uma chave já está configurada ({settings.key_hint}).</p>}
          <div className="flex gap-2 mt-3">
            <button className="btn btn-primary !py-2 !px-4 text-xs" onClick={save} disabled={saving || !providerId}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button className="btn btn-outline !py-2 !px-4 text-xs" onClick={test} disabled={testing || !providerId}>
              {testing ? "Testando..." : "Testar conexão"}
            </button>
          </div>
          {testResult && (
            <p className={`mt-2 text-xs ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
              {testResult.ok ? "✓ " : "✕ "}{testResult.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
