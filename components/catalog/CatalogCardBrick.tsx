"use client";

import { useEffect, useRef, useState } from "react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";

export interface CatalogOrderPayload {
  slug: string;
  productId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerNotes?: string;
  quantity: number;
}

interface CatalogCardBrickProps {
  publicKey: string;
  /** Valor total em reais (ex.: 97.9). Recalculado no servidor — aqui é só exibição. */
  amount: number;
  payerEmail: string;
  maxInstallments: number;
  order: CatalogOrderPayload;
  onPaid: (result: { status: string; orderId: string }) => void;
  onBrickFailure: () => void;
}

function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("token")) return "Não foi possível validar o cartão. Confira os dados e tente de novo.";
  if (m.includes("installments")) return "Parcelamento inválido. Escolha outra opção e tente de novo.";
  if (m.includes("identification") || m.includes("cpf")) return "Confira o CPF/CNPJ do titular e tente de novo.";
  if (m.includes("email")) return "Confira o e-mail e tente de novo.";
  if (m.includes("cc_rejected")) return "Cartão recusado pela operadora. Tente outro cartão ou o PIX.";
  return msg.slice(0, 300);
}

/**
 * Brick de cartão do Mercado Pago para o catálogo — pagamento 100% dentro
 * da página do produto (checkout transparente, sem redirect).
 */
export function CatalogCardBrick({
  publicKey,
  amount,
  payerEmail,
  maxInstallments,
  order,
  onPaid,
  onBrickFailure,
}: CatalogCardBrickProps) {
  const [ready, setReady] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const initRef = useRef(false);
  const aliveRef = useRef(true);
  const callbacksRef = useRef({ onPaid, onBrickFailure });
  callbacksRef.current = { onPaid, onBrickFailure };
  const orderRef = useRef(order);
  orderRef.current = order;

  useEffect(() => {
    aliveRef.current = true;
    if (!initRef.current && publicKey) {
      initRef.current = true;
      try {
        initMercadoPago(publicKey, { locale: "pt-BR" });
      } catch {
        callbacksRef.current.onBrickFailure();
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
      const o = orderRef.current;
      const res = await fetch("/api/catalogo/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: o.slug,
          productId: o.productId,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone || undefined,
          customerNotes: o.customerNotes || undefined,
          quantity: o.quantity,
          formData,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Pagamento não aprovado.");
      const status = String(json.status || "");
      if (status === "approved" || status === "pending" || status === "in_process" || status === "in_mediation" || status === "authorized") {
        callbacksRef.current.onPaid({ status, orderId: String(json.orderId || "") });
        return;
      }
      throw new Error(json.statusDetail ? `Pagamento não aprovado (${json.statusDetail}).` : "Pagamento não aprovado.");
    } catch (e) {
      const message = friendly(e instanceof Error ? e.message : "Erro ao processar pagamento.");
      if (aliveRef.current) setSubmitError(message);
      throw new Error(message);
    } finally {
      if (aliveRef.current) setSubmitting(false);
    }
  }

  const safeMax = Number.isFinite(maxInstallments) && maxInstallments >= 1
    ? Math.min(Math.floor(maxInstallments), 12)
    : 1;

  return (
    <div>
      {!ready && (
        <div className="w-full py-8 flex flex-col items-center justify-center gap-3 text-center" aria-live="polite">
          <div className="w-9 h-9 rounded-full border-4 border-[#e8efe8] border-t-[#1d5c3a] animate-spin" />
          <p className="text-sm font-medium text-slate-600">Carregando pagamento seguro...</p>
          <p className="text-xs text-slate-400">Você permanece nesta página ∙ Mercado Pago</p>
        </div>
      )}
      <div className={ready ? undefined : "h-0 overflow-hidden"} aria-hidden={!ready}>
        <Payment
          initialization={{
            amount,
            payer: { email: payerEmail || "cliente@catalogo.com" },
          }}
          customization={{
            paymentMethods: { creditCard: "all", maxInstallments: safeMax },
            visual: { style: { theme: "default" } },
          }}
          onSubmit={handleSubmit as never}
          onReady={() => setReady(true)}
          onError={() => callbacksRef.current.onBrickFailure()}
        />
      </div>
      {submitError && (
        <p className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm leading-6 text-red-800" role="alert">
          {submitError}
        </p>
      )}
    </div>
  );
}
