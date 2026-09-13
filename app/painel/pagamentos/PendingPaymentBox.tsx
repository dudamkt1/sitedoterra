"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Caixa interativa de pagamento pendente.
 * Client Component puro (síncrono): hooks sempre na mesma ordem,
 * sem early return antes dos hooks, sem imports de servidor.
 */
export function PendingPaymentBox({ tenantId }: { tenantId?: string | null }) {
  const [pendingActivationPayment, setPendingActivationPayment] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const checkPendingPayment = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch("/api/subscription/status");
      const data = await res.json();
      if (data.pendingActivationPayment) {
        setPendingActivationPayment(true);
      }
    } catch {
      // Best-effort
    }
  }, [tenantId]);

  useEffect(() => {
    checkPendingPayment();
  }, [checkPendingPayment]);

  /** "Verificar pagamento": se já foi confirmado, recarrega a página; senão, avisa. */
  async function checkPayment() {
    setChecking(true);
    setMsg(null);
    try {
      const res = await fetch("/api/subscription/status");
      const data = await res.json();
      if (data.activated || data.hasActivationPayment) {
        window.location.reload();
      } else {
        setMsg("Pagamento ainda não confirmado. Conclua na aba de pagamento ou clique em Pagar Agora para gerar o link.");
      }
    } catch {
      setMsg("Não foi possível verificar agora. Tente novamente em instantes.");
    } finally {
      setChecking(false);
    }
  }

  /** "Pagar Agora": leva para o checkout, onde o usuário escolhe
   *  novamente como pagar (PIX/cartão) e finaliza o pagamento. */
  function payNow() {
    window.location.href = "/checkout";
  }

  if (pendingActivationPayment === null) return null;

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="font-semibold text-sm text-amber-900">⏳ Pagamento pendente</p>
      <p className="text-xs text-amber-800 mt-1">
        Você iniciou a ativação mas o pagamento ainda não foi concluído.
        Finalize na aba de pagamento ou use as opções abaixo quando quiser.
      </p>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <button type="button" className="btn btn-outline !py-2.5 text-xs" onClick={checkPayment} disabled={checking}>
          {checking ? "Verificando..." : "🔄 Verificar pagamento"}
        </button>
        {pendingActivationPayment && (
          <button type="button" className="btn btn-gold !py-2.5 text-xs" onClick={payNow} disabled={checking}>
            Pagar Agora
          </button>
        )}
      </div>
      {msg && <p className="text-xs text-amber-800 mt-2">{msg}</p>}
    </div>
  );
}
