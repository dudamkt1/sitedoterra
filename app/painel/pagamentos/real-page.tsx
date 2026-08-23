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
  let rows: any[] = DEMO_ROWS;

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
      </div>
    </div>
  );
}
