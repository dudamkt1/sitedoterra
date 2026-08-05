"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/dashboard/ui";

interface DomainManagerProps {
  domains: any[];
  slug: string;
  appUrl: string;
}

interface DnsRecord {
  type: string;
  host: string;
  value: string;
  ttl?: string;
}

export function DomainManager({ domains, slug, appUrl }: DomainManagerProps) {
  const [step, setStep] = useState<1 | 2 | 3>(domains.length > 0 ? 3 : 1);
  const [domain, setDomain] = useState("");
  const [useWww, setUseWww] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<{ records: DnsRecord[]; explanation: string } | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyOk, setVerifyOk] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const mainDomain = new URL(appUrl || "https://sitedoterra.vercel.app").host;

  async function connect() {
    setError(null);
    const value = useWww && !domain.startsWith("www.") ? `www.${domain}` : domain;
    setConnecting(true);
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: value }),
    });
    const data = await res.json();
    setConnecting(false);
    if (res.ok) {
      setInstructions(data.instructions);
      setStep(3);
      window.location.reload();
    } else {
      setError(data.error || "Erro ao conectar o domínio.");
    }
  }

  async function verify(domainId: string) {
    setVerifying(true);
    setVerifyMsg(null);
    setVerifyOk(false);
    const res = await fetch(`/api/domains/${domainId}/verify`, { method: "POST" });
    const data = await res.json();
    setVerifying(false);
    if (res.ok) {
      setVerifyOk(data.verified);
      setVerifyMsg(data.verified
        ? "Domínio verificado! A Vercel está emitindo o certificado SSL automaticamente. Seu site ficará disponível em HTTPS em breve."
        : data.message || "Ainda não detectamos a configuração correta.");
    } else {
      setVerifyMsg(data.error || "Erro ao verificar.");
    }
  }

  async function remove(domainId: string) {
    if (!confirm("Remover este domínio? Seu site continua disponível na URL padrão.")) return;
    setRemoving(true);
    await fetch(`/api/domains/${domainId}`, { method: "DELETE" });
    setRemoving(false);
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      {/* Lista de domínios */}
      {domains.length > 0 && (
        <div className="card">
          <h2 className="card-title mb-4">Seu domínio conectado</h2>
          <div className="space-y-4">
            {domains.filter((d) => d.status !== "removed").map((d) => (
              <div key={d.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">https://{d.domain}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Conectado em {new Date(d.connected_at).toLocaleDateString("pt-BR")}
                      {d.verified_at && ` · Verificado em ${new Date(d.verified_at).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.status} />
                    <button className="btn btn-outline !py-1.5 !px-3 text-xs" onClick={() => verify(d.id)} disabled={verifying}>
                      {verifying ? "Verificando..." : "Verificar domínio"}
                    </button>
                    <button className="btn btn-danger !py-1.5 !px-3 text-xs" onClick={() => remove(d.id)} disabled={removing}>
                      Remover
                    </button>
                  </div>
                </div>
                {d.error_message && d.status === "error" && (
                  <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                    {d.error_message}
                  </div>
                )}
                {verifyMsg && (
                  <div className={`mt-3 rounded-lg px-4 py-3 text-sm ${verifyOk ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-800"}`}>
                    {verifyMsg}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conectar novo domínio */}
      {domains.filter((d) => d.status !== "removed").length === 0 && (
        <div className="card">
          <h2 className="card-title mb-1">Conectar um novo domínio</h2>
          <p className="text-sm text-gray-500 mb-5">
            Enquanto isso, seu site continua disponível em <strong>{appUrl}/{slug}</strong>.
          </p>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label">Seu domínio</label>
                <input
                  className="input"
                  placeholder="meusite.com.br"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value.toLowerCase())}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={useWww} onChange={(e) => setUseWww(e.target.checked)} className="w-4 h-4 accent-[#1d5c3a]" />
                  Meu domínio usa www (ex.: www.meusite.com.br)
                </label>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button className="btn btn-primary" onClick={connect} disabled={connecting || !domain}>
                {connecting ? "Conectando..." : "Continuar"}
              </button>
            </div>
          )}

          {step === 3 && instructions && (
            <DnsInstructions instructions={instructions} domain={domain || "seu-dominio"} />
          )}
        </div>
      )}

      {/* Ajuda / documentação */}
      <div className="card">
        <button onClick={() => setShowHelp(!showHelp)} className="flex items-center justify-between w-full">
          <h2 className="card-title">Como conectar meu domínio?</h2>
          <span className="text-gray-400">{showHelp ? "−" : "+"}</span>
        </button>
        {showHelp && (
          <ol className="mt-4 space-y-3 text-sm text-gray-600 list-decimal pl-5">
            <li><strong>Compre/tenha seu domínio</strong> em um registrador (GoDaddy, Registro.br, Hostinger, etc.).</li>
            <li>Digite seu domínio no campo acima e clique em continuar.</li>
            <li>O sistema mostrará os <strong>registros DNS</strong> que você precisa criar.</li>
            <li>Acesse o painel da empresa onde o domínio está registrado e abra as configurações de <strong>DNS</strong>.</li>
            <li>Crie (ou edite) os registros exatamente como indicado. <strong>Não altere outros registros.</strong></li>
            <li>Aguarde a propagação (de alguns minutos até 24h).</li>
            <li>Volte aqui e clique em <strong>&quot;Verificar domínio&quot;</strong>.</li>
            <li>Quando tudo estiver correto, a Vercel ativa o HTTPS automaticamente e seu site é publicado no domínio próprio.</li>
          </ol>
        )}
      </div>
    </div>
  );
}

function DnsInstructions({ instructions, domain }: { instructions: { records: DnsRecord[]; explanation: string }; domain: string }) {
  return (
    <div className="mt-2 space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
        <strong>Passo a passo:</strong> acesse o painel do seu provedor de domínio e crie os registros abaixo:
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="table-base">
          <thead>
            <tr><th>Tipo</th><th>Host</th><th>Valor / Destino</th><th>TTL</th></tr>
          </thead>
          <tbody>
            {instructions.records.map((r, i) => (
              <tr key={i}>
                <td><span className="badge badge-blue">{r.type}</span></td>
                <td><code className="text-sm">{r.host === "@" ? `${domain} (raiz)` : r.host}</code></td>
                <td><code className="text-sm break-all">{r.value}</code></td>
                <td className="text-gray-400">{r.ttl || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">{instructions.explanation}</p>
      <p className="text-sm text-gray-500">
        Depois de criar os registros, aguarde a propagação e volte ao painel para <strong>verificar o domínio</strong>.
      </p>
    </div>
  );
}
