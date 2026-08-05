import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/components/dashboard/ui";
import { formatBRL, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminFinanceiroPage() {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: payments }, { data: history }, { data: subs }] = await Promise.all([
    admin.from("payments").select("*").order("created_at", { ascending: false }).limit(500),
    admin.from("billing_history").select("*").order("created_at", { ascending: false }).limit(500),
    admin.from("subscriptions").select("status"),
  ]);

  const pays = (payments || []) as any[];
  const monthPays = pays.filter((p) => new Date(p.created_at) >= new Date(monthStart));

  const total = pays.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amount_cents, 0);
  const month = monthPays.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amount_cents, 0);
  const activation = pays.filter((p) => p.status === "succeeded" && p.type === "activation").reduce((s, p) => s + p.amount_cents, 0);
  const recurring = pays.filter((p) => p.status === "succeeded" && p.type === "subscription").reduce((s, p) => s + p.amount_cents, 0);

  const subList = (subs || []) as any[];
  const active = subList.filter((s) => s.status === "active").length;
  const canceled = subList.filter((s) => s.status === "canceled").length;
  const overdue = subList.filter((s) => s.status === "past_due" || s.status === "unpaid").length;

  const rows = [...(history as any[]).map((h) => ({ ...h, src: "invoice" })), ...pays.map((p) => ({ ...p, src: "payment" }))]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const cards = [
    { l: "Faturamento total", v: formatBRL(total) },
    { l: "Faturamento no mês", v: formatBRL(month) },
    { l: "Ativações", v: formatBRL(activation) },
    { l: "Mensalidades", v: formatBRL(recurring) },
    { l: "Assinaturas ativas", v: String(active) },
    { l: "Canceladas", v: String(canceled) },
    { l: "Inadimplentes", v: String(overdue) },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Financeiro</h1>
      <p className="text-sm text-gray-500 mb-8">Resumo financeiro e histórico de transações.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.l} className="card">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{c.l}</p>
            <p className="mt-2 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{c.v}</p>
          </div>
        ))}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold">Histórico de transações</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Status</th><th>Referência</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs">{formatDateTime(r.created_at)}</td>
                  <td>{r.type === "activation" ? "Ativação" : r.type === "subscription" ? "Mensalidade" : r.type}</td>
                  <td>{formatBRL(r.amount_cents)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-xs text-gray-400">{r.stripe_invoice_id || r.stripe_checkout_session_id || "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-8">Sem transações.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
