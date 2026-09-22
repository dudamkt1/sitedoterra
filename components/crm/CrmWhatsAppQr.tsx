"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, RefreshCw, LogOut, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

/**
 * Conexão via QR Code (Evolution API).
 * O usuário escaneia UMA vez com o WhatsApp do celular; a sessão fica ativa
 * no servidor Evolution e os envios do painel saem direto, sem confirmar
 * um por um. O API Key nunca sai do servidor (tudo via proxy /api/crm).
 */
export default function CrmWhatsAppQr({ refreshKey, savedProvider }: { refreshKey: number; savedProvider: string | null }) {
  const [state, setState] = useState<string>("unknown");
  const [instance, setInstance] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPoll, [stopPoll]);

  // O QR só funciona com a configuração SALVA como evolution: o backend lê
  // o que está no banco (não o que está só selecionado no menu acima).
  const ready = savedProvider === "evolution";

  const checkStatus = useCallback(async (silent = false) => {
    if (!silent) setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/whatsapp/evolution", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Falha ao verificar.");
      setState(String(json.state || "unknown"));
      if (json.instance) setInstance(String(json.instance));
      if (json.connected) {
        setQr(null);
        stopPoll();
        if (!silent) setNotice("WhatsApp conectado! Os envios saem direto, sem confirmação.");
      }
      return Boolean(json.connected);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Falha ao verificar.");
      return false;
    } finally {
      if (!silent) setChecking(false);
    }
  }, [stopPoll]);

  // Verifica ao aparecer / quando a configuração é salva no painel pai.
  useEffect(() => {
    if (!ready) return;
    checkStatus(true);
  }, [refreshKey, checkStatus, ready]);

  async function generateQr() {
    if (!ready) {
      setError("Selecione o provedor Evolution API acima e clique em “Salvar configuração” antes de gerar o QR Code.");
      return;
    }
    setQrLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/crm/whatsapp/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "qr" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Falha ao gerar QR Code.");
      if (json.connected) {
        setState("open");
        setNotice("WhatsApp já estava conectado!");
        return;
      }
      if (json.qr) {
        setQr(String(json.qr));
        if (json.state) setState(String(json.state));
        // Revalida o status a cada 4s (QR expira em ~30-60s no WhatsApp).
        stopPoll();
        let tries = 0;
        pollRef.current = setInterval(async () => {
          tries += 1;
          const ok = await checkStatus(true);
          if (ok || tries >= 22) {
            stopPoll();
            if (!ok) setError("QR Code expirou. Clique em “Gerar novo QR Code”.");
          }
        }, 4000);
      } else {
        throw new Error("Resposta inesperada do servidor Evolution.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar QR Code.");
    } finally {
      setQrLoading(false);
    }
  }

  async function disconnect() {
    if (typeof window !== "undefined" && !window.confirm("Desconectar o WhatsApp? Os envios diretos param até reconectar.")) return;
    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/whatsapp/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Falha ao desconectar.");
      setQr(null);
      stopPoll();
      setState("close");
      setNotice(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao desconectar.");
    } finally {
      setActing(false);
    }
  }

  const connected = state === "open";

  return (
    <div className="card mb-6 border-emerald-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="card-title flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#1d5c3a]" />
            Conexão via QR Code
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Escaneie <b>uma vez</b> e envie várias mensagens direto pelo painel, sem confirmar uma por uma.
            {instance ? <> Instância: <code className="bg-gray-100 px-1 rounded font-mono">{instance}</code>.</> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
              connected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : state === "connecting"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-gray-50 text-gray-600 border-gray-200"
            }`}
          >
            {connected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
            {connected ? "Conectado" : state === "connecting" ? "Aguardando leitura..." : state === "not_found" ? "Instância nova" : "Desconectado"}
          </span>
          <button
            type="button"
            className="btn btn-outline !py-1.5 !text-xs"
            disabled={checking}
            onClick={() => checkStatus(false)}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${checking ? "animate-spin" : ""}`} />
            Verificar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700 flex items-start gap-2 mb-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {!ready && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800 flex items-start gap-2 mb-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Você selecionou <b>Evolution API</b> no campo Provedor, mas ainda não salvou.
            Clique em <b>“Salvar configuração”</b> acima para ativar e liberar o QR Code.
          </span>
        </div>
      )}
      {notice && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-sm text-emerald-700 flex items-start gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {connected ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-emerald-50/60 border border-emerald-100 px-4 py-3">
          <p className="text-sm text-emerald-800">
            ✅ Sessão ativa — use <b>Enviar mensagem</b> abaixo quantas vezes quiser, direto do navegador.
          </p>
          <button type="button" className="btn btn-outline !text-xs shrink-0" disabled={acting} onClick={disconnect}>
            <LogOut className="h-3.5 w-3.5 mr-1" />
            {acting ? "Desconectando..." : "Desconectar"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="space-y-2">
            <ol className="text-sm text-gray-600 space-y-1.5 list-decimal pl-5">
              <li>Preencha e <b>salve</b> a configuração Evolution acima (URL do servidor, API Key e Instance Name).</li>
              <li>Clique em <b>Gerar QR Code</b>.</li>
              <li>No celular: WhatsApp → <b>⋮ / ⚙ → Aparelhos conectados → Conectar aparelho</b> e escaneie.</li>
            </ol>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="btn btn-primary !text-sm" disabled={qrLoading || !ready} onClick={generateQr}>
                {qrLoading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando...</> : <><QrCode className="h-4 w-4 mr-1" /> {qr ? "Gerar novo QR Code" : "Gerar QR Code"}</>}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Precisa de um servidor Evolution (gratuito, open-source — suba com Docker ou use uma hospedagem).
              Sem ele, continue no <b>Modo simples</b> (wa.me), que não precisa de QR.
            </p>
          </div>
          <div className="flex justify-center">
            {qr ? (
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR Code para conectar o WhatsApp" className="w-56 h-56 bg-white p-2 rounded-xl border border-emerald-200 shadow-sm mx-auto" />
                <p className="text-xs text-amber-700 mt-2">Escaneie rápido — o código expira em segundos.</p>
              </div>
            ) : (
              <div className="w-56 h-56 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 text-gray-400">
                <QrCode className="h-10 w-10" />
                <span className="text-xs text-center px-4">O QR Code aparece aqui</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
