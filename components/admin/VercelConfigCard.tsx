"use client";

import { useState } from "react";

interface VercelStatus {
  projectIdSource: "env" | "admin" | null;
  hasToken: boolean;
  teamIdSource: "env" | "admin" | null;
  verifiedAt: string | null;
  projectName: string | null;
  live?: { ok: boolean; projectName?: string | null; message: string };
}

/**
 * Card de credenciais da API Vercel (Super Admin → /admin/dominios).
 * Sem Project ID + token VÁLIDOS (testados ao vivo), nenhum usuário consegue
 * conectar domínio próprio.
 */
export function VercelConfigCard({ initial }: { initial: VercelStatus }) {
  const [status, setStatus] = useState<VercelStatus>(initial);
  const [projectId, setProjectId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [teamId, setTeamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const hasCreds = Boolean(status.projectIdSource) && status.hasToken;
  // "Funcionando" só quando a API respondeu de verdade (testado ao vivo).
  const proven = Boolean(status.verifiedAt) && hasCreds;

  function applyStatus(data: VercelStatus) {
    setStatus({
      projectIdSource: data.projectIdSource ?? status.projectIdSource,
      hasToken: data.hasToken ?? status.hasToken,
      teamIdSource: data.teamIdSource ?? status.teamIdSource,
      verifiedAt: (data as VercelStatus).verifiedAt ?? status.verifiedAt,
      projectName: (data as VercelStatus).projectName ?? status.projectName,
      live: data.live,
    });
  }

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
        applyStatus(data);
        setApiToken("");
        if (data.live?.ok) {
          setMsg({ ok: true, text: `✅ ${data.live.message}` });
        } else {
          setMsg({ ok: false, text: `⚠️ Salvo, mas o teste falhou: ${data.live?.message || "verifique os dados."}` });
        }
      }
    } catch {
      setMsg({ ok: false, text: "Falha de conexão." });
    }
    setSaving(false);
  }

  async function test() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/vercel-config?test=1");
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Erro ao testar." });
      } else {
        applyStatus(data);
        setMsg({ ok: Boolean(data.live?.ok), text: data.live?.ok ? `✅ ${data.live.message}` : `❌ ${data.live?.message}` });
      }
    } catch {
      setMsg({ ok: false, text: "Falha de conexão." });
    }
    setTesting(false);
  }

  return (
    <div className={`card mb-6 ${proven ? "" : "!border-red-200"}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="card-title mb-0">Infraestrutura Vercel (domínios próprios)</h2>
        <span className={`badge ${proven ? "badge-green" : hasCreds ? "badge-yellow" : "badge-red"}`}>
          {proven ? "● Funcionando" : hasCreds ? "● Salvo, não testado" : "● Não configurado"}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-1">
        Project ID + token da API Vercel. Sem isso, <b>nenhum usuário consegue conectar domínio próprio</b>.
        Vale o ENV (dashboard da Vercel) ou o que for salvo aqui — o ENV tem prioridade.
      </p>
      {status.verifiedAt && (
        <p className="text-xs text-green-700 mb-3">
          ✅ Último teste com sucesso em {new Date(status.verifiedAt).toLocaleString("pt-BR")}
          {status.projectName ? ` · projeto “${status.projectName}”` : ""}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Project ID {status.projectIdSource ? `(via ${status.projectIdSource === "env" ? "ENV" : "admin"})` : ""}</label>
          <input className="input" value={projectId} onChange={(e) => setProjectId(e.target.value.trim())} placeholder="prj_..." autoComplete="off" />
        </div>
        <div>
          <label className="label">API Token {status.hasToken ? "(cadastrado ••••)" : ""}</label>
          <input type="password" className="input" value={apiToken} onChange={(e) => setApiToken(e.target.value.trim())} placeholder="Deixe vazio para manter o atual" autoComplete="new-password" />
        </div>
        <div>
          <label className="label">Team ID (se o projeto for de um Time) {status.teamIdSource ? `(via ${status.teamIdSource === "env" ? "ENV" : "admin"})` : ""}</label>
          <input className="input" value={teamId} onChange={(e) => setTeamId(e.target.value.trim())} placeholder="team_..." autoComplete="off" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Salvando e testando..." : "Salvar e testar"}
        </button>
        <button className="btn btn-outline" onClick={test} disabled={testing}>
          {testing ? "Testando..." : "🔌 Testar conexão"}
        </button>
        <button className="btn btn-outline !border-0 !px-2 text-xs" onClick={() => setShowGuide(!showGuide)}>
          {showGuide ? "Ocultar guia −" : "Onde pego esses dados? +"}
        </button>
        {msg && <span className={`text-sm w-full sm:w-auto ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
      {showGuide && (
        <ol className="mt-4 space-y-2.5 text-sm text-gray-600 list-decimal pl-5 rounded-xl bg-gray-50 border border-gray-100 p-4 pl-9">
          <li><strong>Token:</strong> vercel.com → avatar → <strong>Account Settings → Tokens → Create</strong> (qualquer nome, sem expiração ou com 1 ano) → <strong>copie na hora</strong> (só aparece uma vez).</li>
          <li><strong>Project ID:</strong> dashboard → seu projeto → <strong>Settings → General</strong> → copie o <strong>Project ID</strong> (começa com <code>prj_</code>).</li>
          <li><strong>Team ID (só se o projeto for de um Time):</strong> selecione o Time → <strong>Settings → General</strong> → copie o <strong>Team ID</strong>. Projeto pessoal não precisa.</li>
          <li>Cole os 3 campos acima e clique <strong>“Salvar e testar”</strong> — o selo precisa ficar <strong className="text-green-700">● Funcionando</strong>.</li>
        </ol>
      )}
    </div>
  );
}
