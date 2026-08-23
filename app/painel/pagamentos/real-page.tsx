import { getDashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SectionTitle, StatusBadge } from "@/components/dashboard/ui";
import { formatBRL, formatDateTime } from "@/lib/utils";

export default async function PagamentosPage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;

  const tenantId = ctx.tenant?.id;
  const admin = createAdminClient();
  const [{ data: payments }, { data: history }] = await Promise.all([
    tenantId
      ? admin.from("payments").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    tenantId
      ? admin.from("billing_history").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
  ]);

  const rows = [...(history as any[]).map((h) => ({ ...h, source: "cobranca" })), ...(payments as any[]).map((p) => ({ ...p, source: "pagamento" }))]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
