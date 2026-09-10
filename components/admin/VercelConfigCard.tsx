"use client";

import { useState } from "react";

interface VercelStatus {
  projectIdSource: "env" | "admin" | null;
  hasToken: boolean;
  teamIdSource: "env" | "admin" | null;
}

/**
 * Card de credenciais da API Vercel (Super Admin → /admin/dominios).
 * Sem Project ID + token, nenhum usuário consegue conectar domínio próprio.
 */
export function VercelConfigCard({ initial }: { initial: VercelStatus }) {
  const [status, setStatus] = useState<VercelStatus>(initial);
  const [projectId, setProjectId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [teamId, setTeamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const configured = Boolean(status.projectIdSource) && status.hasToken;

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/vercel-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, apiToken, teamId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Erro ao salvar." });
      } else {
        setMsg({ ok: true, text: "Credenciais salvas. Conexão de domínios liberada." });
        setStatus({ projectIdSource: data.projectIdSource ?? status.projectIdSource, hasToken: data.hasToken ?? true, teamIdSource: data.teamIdSource ?? status.teamIdSource });
        setApiToken("");
      }
    } catch {
      setMsg({ ok: false, text: "Falha de conexão." });
    }
    setSaving(false);
  }

  return (
    <div className={`card mb-6 ${configured ? "" : "!border-red-200"}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="card-title mb-0">Infraestrutura Vercel (domínios próprios)</h2>
        <span className={`badge ${configured ? "badge-green" : "badge-red"}`}>
          {configured ? "● Conectado" : "● Não configurado"}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Project ID + token da API Vercel. Sem isso, <b>nenhum usuário consegue conectar domínio próprio</b>.
        Vale o ENV (Vercel dashboard) ou o que for salvo aqui — o ENV tem prioridade.
        Token: crie em vercel.com → Settings → Tokens (escopo do projeto).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Project ID {status.projectIdSource ? `(via ${status.projectIdSource === "env" ? "ENV" : "admin"})` : ""}</label>
          <input className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="prj_..." />
        </div>
        <div>
          <label className="label">API Token {status.hasToken ? "(cadastrado ••••)" : ""}</label>
          <input type="password" className="input" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="Deixe vazio para manter o atual" autoComplete="new-password" />
        </div>
        <div>
          <label className="label">Team ID (opcional) {status.teamIdSource ? `(via ${status.teamIdSource === "env" ? "ENV" : "admin"})` : ""}</label>
          <input className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="Só se o projeto for de um Time" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar credenciais"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
