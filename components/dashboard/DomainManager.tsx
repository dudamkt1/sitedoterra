"use client";

import { useEffect, useState } from "react";
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

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR");
}

export function DomainManager({ domains, slug, appUrl }: DomainManagerProps) {
  // Estado local: lista e ações (conectar/desconectar) vivem aqui. Os props são
  // apenas o estado inicial — assim desconectar/conectar reflete na hora, sem
  // depender de reload (que no modo demonstração voltaria ao estado inicial).
  const [items, setItems] = useState<any[]>(Array.isArray(domains) ? domains : []);
  // Domínios vigentes: lista e formulário dependem SÓ deste filtro (nunca de
  // domains.length, que também conta linhas "removed").
  const activeDomains = items.filter((d) => d.status !== "removed");

  const [step, setStep] = useState<1 | 3>(1);
  const [domain, setDomain] = useState("");
  const [useWww, setUseWww] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<{ records: DnsRecord[]; explanation: string } | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyOk, setVerifyOk] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Hidrata a lista pela API (fonte de verdade). setTimeout(0) garante que o
  // DemoFetchBridge do modo demonstração já instalou o interceptor de fetch.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch("/api/domains")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.domains)) setItems(data.domains);
        })
        .catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function connect() {
    setError(null);
    const value = useWww && !domain.startsWith("www.") ? `www.${domain}` : domain;
    setConnecting(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      const data = await res.json();
      if (res.ok) {
        // Entra na lista na hora (a resposta pode não trazer a linha no modo
        // demonstração) e as instruções DNS aparecem abaixo — sem reload, que
        // apagaria o que o usuário precisa ver agora.
        const row = data.domain || {
          id: `local-${value}`,
          domain: value,
          status: "pending",
          connected_at: new Date().toISOString(),
        };
        setItems((prev) => (prev.some((d) => d.domain === row.domain) ? prev : [...prev, row]));
        setInstructions(data.instructions);
        setStep(3);
      } else {
        setError(data.error || "Erro ao conectar o domínio.");
      }
    } catch {
      setError("Falha de comunicação. Verifique sua conexão e tente novamente.");
    } finally {
      setConnecting(false);
    }
  }

  async function verify(domainId: string) {
    setVerifying(true);
    setVerifyMsg(null);
    setVerifyOk(false);
    try {
      const res = await fetch(`/api/domains/${domainId}/verify`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setVerifyOk(data.verified);
        setVerifyMsg(data.verified
          ? "Domínio verificado! A Vercel está emitindo o certificado SSL automaticamente. Seu site ficará disponível em HTTPS em breve."
          : data.message || "Ainda não detectamos a configuração correta.");
        if (data.verified) {
          setItems((prev) =>
            prev.map((d) =>
              d.id === domainId
                ? { ...d, status: data.status || "verified", verified_at: new Date().toISOString() }
                : d
            )
          );
        }
      } else {
        setVerifyMsg(data.error || "Erro ao verificar.");
      }
    } catch {
      setVerifyMsg("Falha de comunicação ao verificar. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  }

  async function remove(domainId: string) {
    if (!confirm("Desconectar este domínio? Seu site continua disponível na URL padrão e você poderá conectar outro domínio em seguida.")) return;
    setError(null);
    setRemovingId(domainId);
    try {
      const res = await fetch(`/api/domains/${domainId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Não foi possível desconectar o domínio. Tente novamente.");
        return;
      }
      // Sai da lista imediatamente → o formulário de conectar outro domínio
      // já está visível embaixo, pronto para o novo endereço.
      setItems((prev) => prev.filter((d) => d.id !== domainId));
      setVerifyMsg(null);
      setInstructions(null);
      setStep(1);
    } catch {
      setError("Falha de comunicação ao desconectar. Tente novamente.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Lista de domínios conectados (só domínios vigentes) */}
      {activeDomains.length > 0 && (
        <div className="card">
          <h2 className="card-title mb-4">{activeDomains.length > 1 ? "Seus domínios conectados" : "Seu domínio conectado"}</h2>
          <div className="space-y-4">
            {activeDomains.map((d) => {
              const connectedIn = formatDate(d.connected_at);
              const verifiedIn = formatDate(d.verified_at);
              const removing = removingId === d.id;
              return (
                <div key={d.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold break-all">https://{d.domain}</p>
                      {(connectedIn || verifiedIn) && (
                        <p className="text-xs text-gray-400 mt-1">
                          {connectedIn && `Conectado em ${connectedIn}`}
                          {connectedIn && verifiedIn && " · "}
                          {verifiedIn && `Verificado em ${verifiedIn}`}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <StatusBadge status={d.status} />
                      <button className="btn btn-outline !py-1.5 !px-3 text-xs" onClick={() => verify(d.id)} disabled={verifying}>
                        {verifying ? "Verificando..." : "Verificar domínio"}
                      </button>
                      <button className="btn btn-danger !py-1.5 !px-3 text-xs" onClick={() => remove(d.id)} disabled={removing}>
                        {removing ? "Desconectando..." : "Desconectar"}
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
              );
            })}
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Para publicar em outro endereço, use o formulário abaixo — este domínio continua ativo até você desconectá-lo.
          </p>
        </div>
      )}

      {/* Conectar domínio — SEMPRE visível (sem domínio, com domínio, ou após desconectar) */}
      <div className="card">
        <h2 className="card-title mb-1">
          {activeDomains.length > 0 ? "Conectar outro domínio" : "Conectar um novo domínio"}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          {activeDomains.length > 0 ? (
            <>Informe o novo endereço abaixo. Ele passa a valer depois do DNS e da verificação — nada muda no seu site.</>
          ) : (
            <>Enquanto isso, seu site continua disponível em <strong>{appUrl}/{slug}</strong>.</>
          )}
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
            <button className="btn btn-primary" onClick={connect} disabled={connecting || !domain}>
              {connecting ? "Conectando..." : "Continuar"}
            </button>
          </div>
        )}

        {step === 3 && instructions && (
          <>
            <DnsInstructions instructions={instructions} domain={domain || "seu-dominio"} />
            <button
              className="btn btn-primary mt-4"
              onClick={() => {
                setInstructions(null);
                setDomain("");
                setUseWww(false);
                setStep(1);
              }}
            >
              Concluir e ver meu domínio
            </button>
          </>
        )}
      </div>

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
