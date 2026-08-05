"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/dashboard/ui";
import { formatBRL, formatDate } from "@/lib/utils";

interface SubManagerProps {
  subscription: any;
  plans: any[];
  billingHistory: any[];
  payments: any[];
}

export function SubscriptionManager({ subscription, plans, billingHistory, payments }: SubManagerProps) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const paymentOk = searchParams.get("sucesso") === "1";

  async function checkout(planId: string) {
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setMsg({ ok: false, text: data.error || "Não foi possível iniciar o pagamento." });
      setLoading(false);
    }
  }

  async function cancel() {
    setLoading(true);
    const res = await fetch("/api/cancel-subscription", { method: "POST" });
    const data = await res.json();
    setMsg(data.success
      ? { ok: true, text: "Cancelamento agendado. Sua assinatura continua até o fim do período contratado e seu site será suspenso depois. Seus dados estão preservados." }
      : { ok: false, text: data.error || "Erro ao cancelar." });
    setLoading(false);
    setConfirmCancel(false);
  }

  async function reactivate() {
    setLoading(true);
    const res = await fetch("/api/reactivate-subscription", { method: "POST" });
    const data = await res.json();
    setMsg(data.success
      ? { ok: true, text: "Assinatura reativada! Seu site voltou ao ar." }
      : { ok: false, text: data.error || "Erro ao reativar." });
    setLoading(false);
  }

  async function openBillingPortal() {
    setLoading(true);
    const res = await fetch("/api/billing-portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setMsg({ ok: false, text: data.error || "Erro ao abrir portal de pagamento." });
    setLoading(false);
  }

  const isActive = subscription?.status === "active";
  const isCanceled = subscription?.status === "canceled" || subscription?.cancel_at_period_end;
  const nextBilling = subscription?.next_billing_at || subscription?.current_period_end;
  const statusLabel = isCanceled && subscription?.cancel_at_period_end
    ? "Cancelamento agendado para o fim do período"
    : undefined;

  return (
    <div className="space-y-6">
      {paymentOk && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 text-sm text-green-700">
          Pagamento confirmado! Sua assinatura está sendo ativada. Pode levar alguns instantes para o site entrar no ar.
        </div>
      )}

      {/* Estado atual */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Plano</p>
          <p className="mt-2 text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            {subscription?.plan?.name || "Nenhum plano ativo"}
          </p>
          {subscription?.plan && <p className="text-sm text-gray-400 mt-1">{formatBRL(subscription.plan.monthly_price_cents)}/mês</p>}
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Status</p>
          <div className="mt-2"><StatusBadge status={subscription?.status || "awaiting_activation"} /></div>
          {statusLabel && <p className="text-xs text-gray-400 mt-2">{statusLabel}</p>}
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Próxima cobrança</p>
          <p className="mt-2 text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            {nextBilling ? formatDate(nextBilling) : "—"}
          </p>
          {subscription?.plan && <p className="text-sm text-gray-400 mt-1">{formatBRL(subscription.plan.monthly_price_cents)}</p>}
        </div>
      </div>

      {msg && (
        <p className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}

      {/* Ações */}
      <div className="card">
        <h2 className="card-title mb-4">Ações</h2>
        <div className="flex flex-wrap gap-3">
          {isActive && (
            <>
              <button className="btn btn-outline" onClick={openBillingPortal} disabled={loading}>
                💳 Atualizar forma de pagamento
              </button>
              {!confirmCancel ? (
                <button className="btn btn-danger" onClick={() => setConfirmCancel(true)} disabled={loading}>
                  Cancelar assinatura
                </button>
              ) : (
                <div className="flex items-center gap-3 bg-red-50 rounded-lg px-4 py-2">
                  <span className="text-sm text-red-700">Cancelar mesmo? Seu site ficará suspenso no fim do período, mas seus dados são preservados.</span>
                  <button className="btn btn-danger !py-1.5" onClick={cancel} disabled={loading}>Sim, cancelar</button>
                  <button className="btn btn-outline !py-1.5" onClick={() => setConfirmCancel(false)}>Voltar</button>
                </div>
              )}
            </>
          )}

          {isCanceled && (
            <button className="btn btn-gold" onClick={reactivate} disabled={loading}>
              {loading ? "Processando..." : "♻️ Reativar assinatura"}
            </button>
          )}

          {!subscription && plans.map((p) => (
            <button key={p.id} className="btn btn-gold" onClick={() => checkout(p.id)} disabled={loading}>
              Assinar {p.name} — {formatBRL(p.monthly_price_cents)}
              {p.activation_price_cents > 0 && ` + ativação ${formatBRL(p.activation_price_cents)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Histórico de pagamentos */}
      <div className="card">
        <h2 className="card-title mb-4">Histórico de pagamentos</h2>
        {billingHistory.length === 0 && payments.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum pagamento registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDate(h.created_at)}</td>
                    <td>{h.type === "activation" ? "Ativação" : "Mensalidade"}</td>
                    <td>{formatBRL(h.amount_cents)}</td>
                    <td><StatusBadge status={h.status} /></td>
                  </tr>
                ))}
                {payments.filter((p) => !billingHistory.some((b) => b.stripe_charge_id === p.stripe_payment_intent_id)).map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.created_at)}</td>
                    <td>{p.type === "activation" ? "Ativação" : p.type === "subscription" ? "Mensalidade" : p.type}</td>
                    <td>{formatBRL(p.amount_cents)}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
