"use client";

import { useEffect, useState } from "react";
import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SectionTitle, StatusBadge } from "@/components/dashboard/ui";
import { formatBRL, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEMO_ROWS = [
  {
    id: "pay_1",
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    type: "activation",
    amount_cents: 29700,
    status: "succeeded",
    stripe_invoice_id: null,
    stripe_checkout_session_id: null,
    source: "pagamento",
  },
  {
    id: "bh_2",
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    type: "subscription",
    amount_cents: 4700,
    status: "succeeded",
    stripe_invoice_id: null,
    stripe_checkout_session_id: "demo-session-2",
    source: "cobranca",
  },
];

export default async function PagamentosPage(p: { demoCtx?: DashboardContext }) {
  const ctx = p.demoCtx ?? (await getDashboardContext());
  if (!ctx?.profile) return null;

  const tenantId = ctx.tenant?.id;
  const [pendingActivationPayment, setPendingActivationPayment] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  let rows: any[] = DEMO_ROWS;

  useEffect(() => {
    async function checkPendingPayment() {
      if (!tenantId) return;
      setChecking(true);
      try {
        const res = await fetch("/api/subscription/status");
        const data = await res.json();
        if (data.pendingActivationPayment) {
          setPendingActivationPayment(true);
        }
      } catch {
        // Best-effort
      } finally {
        setChecking(false);
      }
    }
    checkPendingPayment();
  }, [tenantId]);

  if (tenantId && !p.demoCtx) {
    const admin = createAdminClient();
    const [{ data: payments }, { data: history }] = await Promise.all([
      admin.from("payments").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
      admin.from("billing_history").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
    ]);
    rows = [
      ...((history as any[]) || []).map((h) => ({ ...h, source: "cobranca" })),
      ...((payments as any[]) || []).map((x) => ({ ...x, source: "pagamento" })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return (
    <div>
      <SectionTitle sub="Todos os pagamentos e cobranças do seu site.">Pagamentos</SectionTitle>
      <div className="card">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum pagamento registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Referência</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>{r.type === "activation" ? "Ativação" : r.type === "subscription" ? "Mensalidade" : r.type}</td>
                    <td>{formatBRL(r.amount_cents)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-gray-400 text-xs">{r.stripe_invoice_id || r.stripe_checkout_session_id || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pendingActivationPayment !== null && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-sm text-amber-900">⏳ Pagamento pendente</p>
            <p className="text-xs text-amber-800 mt-1">
              Você iniciou a ativação mas o pagamento ainda não foi concluído.
              Finalize na aba de pagamento ou use as opções abaixo quando quiser.
            </p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <button type="button" className="btn btn-outline !py-2.5 text-xs" onClick={checkPendingPayment} disabled={checking}>
                🔄 Verificar pagamento
              </button>
              {pendingActivationPayment && (
                <button type="button" className="btn btn-gold !py-2.5 text-xs" onClick={checkPendingPayment} disabled={checking}>
                  Pagar Agora
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
