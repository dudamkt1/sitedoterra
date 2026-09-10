"use client";

import { useEffect, useRef, useState } from "react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { friendlyError } from "@/app/checkout/CheckoutPageClient";

export interface PixData {
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  paymentId: number | string | null;
}

interface MercadoPagoBrickProps {
  publicKey: string;
  preferenceId?: string | null;
  /** Valor em reais (ex.: 297). Deve refletir a oferta do backend. */
  amount: number;
  payerEmail: string;
  /** Parcelas máximas vindas de /admin/pagamentos (mínimo 1). */
  maxInstallments: number;
  planId?: string;
  onApproved: () => void;
  onPixPending: (pix: PixData) => void;
  onPending: () => void;
  /** Falha crítica do SDK — o pai exibe o fallback (nova aba, sem iframe). */
  onBrickError: () => void;
}

/**
 * Payment Brick do Mercado Pago renderizado DENTRO do /checkout.
 * Cartão e Pix sem redirect externo. A confirmação real continua vindo do
 * backend (webhook) + polling de /api/subscription/status no componente pai.
 */
export function MercadoPagoBrick({
  publicKey,
  preferenceId,
  amount,
  payerEmail,
  maxInstallments,
  planId,
  onApproved,
  onPixPending,
  onPending,
  onBrickError,
}: MercadoPagoBrickProps) {
  const [ready, setReady] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const initRef = useRef(false);
  const aliveRef = useRef(true);
  const callbacksRef = useRef({ onApproved, onPixPending, onPending, onBrickError });
  callbacksRef.current = { onApproved, onPixPending, onPending, onBrickError };

  useEffect(() => {
    aliveRef.current = true;
    if (!initRef.current && publicKey) {
      initRef.current = true;
      try {
        initMercadoPago(publicKey, { locale: "pt-BR" });
      } catch {
        callbacksRef.current.onBrickError();
      }
    }
    return () => {
      aliveRef.current = false;
    };
  }, [publicKey]);

  async function handleSubmit({ formData }: { formData: Record<string, unknown> }) {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/checkout/mp/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData, planId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Erro ao processar pagamento.");
      const status = String(json.status || "");
      if (status === "approved") {
        callbacksRef.current.onApproved();
        return;
      }
      if (status === "pending" || status === "in_process" || status === "in_mediation" || status === "authorized") {
        const poi = json.point_of_interaction?.transaction_data as
          | { qr_code?: string | null; qr_code_base64?: string | null; ticket_url?: string | null }
          | undefined;
        if (poi && (poi.qr_code || poi.qr_code_base64)) {
          callbacksRef.current.onPixPending({
            qr_code: poi.qr_code || null,
            qr_code_base64: poi.qr_code_base64 || null,
            ticket_url: poi.ticket_url || null,
            paymentId: json.id ?? null,
          });
          return;
        }
        callbacksRef.current.onPending();
        return;
      }
      // Recusado/cancelado/expirado — mensagem amigável no próprio Brick.
      throw new Error(json.status_detail ? `Pagamento não aprovado (${json.status_detail}).` : "Pagamento não aprovado.");
    } catch (e) {
      const message = friendlyError(e instanceof Error ? e.message : "Erro ao processar pagamento.");
      if (aliveRef.current) setSubmitError(message);
      throw new Error(message);
    } finally {
      if (aliveRef.current) setSubmitting(false);
    }
  }

  const safeMaxInstallments = Number.isFinite(maxInstallments) && maxInstallments >= 1
    ? Math.min(Math.floor(maxInstallments), 12)
    : 1;

  return (
    <div>
      {!ready && (
        <div className="w-full py-10 flex flex-col items-center justify-center gap-4 text-center" aria-live="polite">
          <div className="w-10 h-10 rounded-full border-4 border-[#e8efe8] border-t-[#103d2d] animate-spin" />
          <p className="text-sm font-medium text-[#4a5a6a] leading-5">Carregando pagamento seguro...</p>
          <p className="text-xs text-[#6b7a89] leading-4">Mercado Pago • Você permanece no site</p>
        </div>
      )}
      <div className={ready ? undefined : "h-0 overflow-hidden"} aria-hidden={!ready}>
        <Payment
          initialization={{
            amount,
            ...(preferenceId ? { preferenceId } : {}),
            payer: { email: payerEmail },
          }}
          customization={{
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
              ticket: "all",
              // PIX no Payment Brick = grupo bankTransfer (doc oficial:
              // "para NÃO incluir um tipo, remova-o do objeto paymentMethods").
              // Sem esta chave a aba PIX ficava oculta em "Meios de pagamento".
              bankTransfer: "all",
              maxInstallments: safeMaxInstallments,
            },
            visual: { style: { theme: "default" } },
          }}
          onSubmit={handleSubmit as never}
          onReady={() => setReady(true)}
          onError={() => callbacksRef.current.onBrickError()}
        />
      </div>
      {submitError && (
        <p className="mt-4 rounded-xl bg-[#fef2f2] border border-[#fde4e4] px-4 py-3 text-sm leading-6 text-[#991b1b]" role="alert">
          {submitError}
        </p>
      )}
    </div>
  );
}
