import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SectionTitle, StatusBadge } from "@/components/dashboard/ui";
import { formatBRL, formatDateTime } from "@/lib/utils";
import { PendingPaymentBox } from "./PendingPaymentBox";
import { PagamentosAutoRefresh } from "./AutoRefresh";

/** Referência curta do gateway para a coluna da tabela (Stripe ou MP). */
function paymentRef(r: any): string {
  return (
    r.mercadopago_payment_id ||
    r.mercadopago_preference_id ||
    r.stripe_invoice_id ||
    r.stripe_checkout_session_id ||
    "—"
  );
}

/**
 * Chave de agrupamento de um lançamento: o mesmo evento é registrado em
 * `payments` e em `billing_history` (ex.: Pago aparece nas duas tabelas, e o
 * reembolso gera `${mpId}:refund`). O sufixo `:refund`/`:refund_pending` é
 * removido para que o grupo represente UM pagamento.
 * Lançamentos sem referência do gateway (ex.: crédito de afiliado) usam o
 * próprio id — nunca são agrupados entre si.
 */
function groupKey(r: any): string {
  const mp = typeof r.mercadopago_payment_id === "string" && r.mercadopago_payment_id
    ? r.mercadopago_payment_id.split(":")[0]
    : null;
  const ref =
    mp ||
    r.mercadopago_preference_id ||
    r.stripe_invoice_id ||
    r.stripe_checkout_session_id ||
    r.stripe_charge_id ||
    r.stripe_payment_intent_id ||
    null;
  if (!ref) return `noref:${r.source || "x"}:${r.id}`;
  return `${r.type || "x"}::${ref}`;
}

/**
 * Remove duplicidades entre `payments` e `billing_history`: por pagamento
 * (referência do gateway) mostra APENAS a última ação — sem repetir o mesmo
 * status (ex.: Pago 2x, Reembolsado 2x). Em empate de data, prefere a linha
 * de `payments` (fonte com metadata completa).
 */
function dedupeRows(rows: any[]): any[] {
  const groups: { key: string; row: any }[] = [];
  const find = (key: string) => {
    for (const g of groups) if (g.key === key) return g;
    return null;
  };
  for (const r of rows) {
    const key = groupKey(r);
    const g = find(key);
    if (!g) {
      groups.push({ key, row: r });
      continue;
    }
    const t = new Date(r.created_at).getTime();
    const ct = new Date(g.row.created_at).getTime();
    if (
      Number.isFinite(t) && Number.isFinite(ct)
        ? t > ct || (t === ct && r.source === "pagamento" && g.row.source !== "pagamento")
        : r.source === "pagamento"
    ) {
      g.row = r;
    }
  }
  return groups
    .map((g) => g.row)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

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
    const merged = [
      ...((history as any[]) || []).map((h) => ({ ...h, source: "cobranca" })),
      ...((payments as any[]) || []).map((x) => ({ ...x, source: "pagamento" })),
    ];
    // A ativação é única: se já existe ativação paga, pendings de ativação
    // são tentativas antigas órfãs (o webhook atual já reconcilia/cancela as
    // novas) — ocultá-las evita o "pendente" fantasma após o sucesso.
    const withoutOrphans =
      merged.some((r) => r.type === "activation" && (r.status === "succeeded" || r.status === "refund_pending" || r.status === "refunded"))
        ? merged.filter((r) => !(r.type === "activation" && r.status === "pending"))
        : merged;
    // Mesmo evento em `payments` + `billing_history`: mostra só a última ação.
    rows = dedupeRows(withoutOrphans);
  }

  const hasPending = rows.some((r) => r.status === "pending");

  return (
    <div>
      <PagamentosAutoRefresh active={hasPending} />
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
                    <td className="text-gray-400 text-xs">{paymentRef(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PendingPaymentBox tenantId={tenantId} />
      </div>
    </div>
  );
}
