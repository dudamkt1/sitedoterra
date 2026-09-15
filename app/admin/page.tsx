import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatCard, StatusBadge } from "@/components/dashboard/ui";
import { formatBRL, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const admin = createAdminClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [payments, subs, tenants, profiles, monthPayments, domains, refunds] = await Promise.all([
    admin.from("payments").select("amount_cents, type, status, created_at"),
    admin.from("subscriptions").select("status, plan:plan_id(monthly_price_cents)"),
    admin.from("tenants").select("site_status"),
    admin.from("profiles").select("status, created_at"),
    admin.from("payments").select("amount_cents, type, status").gte("created_at", monthStart),
    admin.from("domains").select("status"),
    admin
      .from("payments")
      .select("id, tenant_id, amount_cents, status, created_at, mercadopago_payment_id, metadata")
      .eq("type", "activation")
      .in("status", ["refund_pending", "refunded"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const allPayments = (payments.data || []) as any[];
  const totalRevenue = allPayments.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amount_cents, 0);
  const activationRevenue = allPayments.filter((p) => p.status === "succeeded" && p.type === "activation").reduce((s, p) => s + p.amount_cents, 0);
  const recurringRevenue = allPayments.filter((p) => p.status === "succeeded" && p.type === "subscription").reduce((s, p) => s + p.amount_cents, 0);

  const monthAll = (monthPayments.data || []) as any[];
  const monthRevenue = monthAll.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amount_cents, 0);

  const subList = (subs.data || []) as any[];
  const activeSubs = subList.filter((s) => s.status === "active");
  const canceledSubs = subList.filter((s) => s.status === "canceled");
  const overdueSubs = subList.filter((s) => s.status === "past_due" || s.status === "unpaid");

  // MRR: soma das mensalidades ativas
  const mrr = activeSubs.reduce((s, sub) => {
    const price = sub.plan?.monthly_price_cents || 0;
    return s + price;
  }, 0);

  const tenantList = (tenants.data || []) as any[];
  const sitesActive = tenantList.filter((t) => t.site_status === "active").length;
  const sitesSuspended = tenantList.filter((t) => t.site_status === "suspended").length;

  const profileList = (profiles.data || []) as any[];
  const newClientsMonth = profileList.filter((p) => new Date(p.created_at) >= new Date(monthStart)).length;
  const activeAccounts = profileList.filter((p) => p.status === "active").length;
  const blockedAccounts = profileList.filter((p) => p.status === "blocked").length;

  const domainList = (domains.data || []) as any[];
  const verifiedDomains = domainList.filter((d) => d.status === "active" || d.status === "verified").length;

  // ---- Pedidos de Reembolso (garantia de 7 dias) ----
  // `refund_pending` = aguardando devolução do MP (site ainda no ar);
  // `refunded` = dinheiro devolvido (site desativado, histórico preservado).
  const refundRows = ((refunds.data || []) as any[]).filter((r) =>
    ["refund_pending", "refunded"].includes(r.status)
  );
  const awaitingRefunds = refundRows.filter((r) => r.status === "refund_pending");
  const refundedRows = refundRows.filter((r) => r.status === "refunded");
  const awaitingAmount = awaitingRefunds.reduce((s, r) => s + (r.amount_cents || 0), 0);

  let refundDisplay: any[] = [];
  try {
    const tenantIds = Array.from(new Set(refundRows.map((r) => r.tenant_id).filter(Boolean)));
    if (tenantIds.length > 0) {
      const { data: tRows } = await admin
        .from("tenants")
        .select("id, slug, user_id, site_status")
        .in("id", tenantIds);
      const tList = (tRows || []) as any[];
      const userIds = Array.from(new Set(tList.map((t) => t.user_id).filter(Boolean)));
      const emailByUser: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: pRows } = await admin.from("profiles").select("user_id, email").in("user_id", userIds);
        for (const p of ((pRows || []) as any[])) emailByUser[p.user_id] = p.email;
      }
      const tenantById: Record<string, any> = {};
      for (const t of tList) tenantById[t.id] = t;
      refundDisplay = refundRows.map((r) => ({
        ...r,
        slug: tenantById[r.tenant_id]?.slug || "—",
        site_status: tenantById[r.tenant_id]?.site_status || "—",
        email: emailByUser[tenantById[r.tenant_id]?.user_id] || "—",
      }));
    } else {
      refundDisplay = refundRows;
    }
  } catch {
    refundDisplay = refundRows;
  }

  const stats = [
    { label: "Faturamento total", value: formatBRL(totalRevenue), icon: "💰" },
    { label: "Faturamento do mês", value: formatBRL(monthRevenue), icon: "📅" },
    { label: "MRR", value: formatBRL(mrr) + "/mês", icon: "📈" },
    { label: "Receita de ativação", value: formatBRL(activationRevenue), icon: "🚀" },
    { label: "Receita recorrente", value: formatBRL(recurringRevenue), icon: "🔁" },
    { label: "Assinaturas ativas", value: String(activeSubs.length), icon: "✅" },
    { label: "Assinaturas canceladas", value: String(canceledSubs.length), icon: "🚫" },
    { label: "Inadimplentes", value: String(overdueSubs.length), icon: "⚠️" },
    { label: "Sites ativos", value: String(sitesActive), icon: "🌐" },
    { label: "Sites suspensos", value: String(sitesSuspended), icon: "🔴" },
    { label: "Novos clientes (mês)", value: String(newClientsMonth), icon: "🆕" },
    { label: "Contas ativas", value: String(activeAccounts), icon: "👥" },
    { label: "Contas bloqueadas", value: String(blockedAccounts), icon: "⛔" },
    { label: "Domínios verificados", value: String(verifiedDomains), icon: "🔗" },
    { label: "Aguardando reembolso", value: String(awaitingRefunds.length), icon: "⏳" },
    { label: "Valor aguardando", value: formatBRL(awaitingAmount), icon: "💸" },
    { label: "Reembolsados", value: String(refundedRows.length), icon: "↩️" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Visão geral</h1>
      <p className="text-sm text-gray-500 mb-8">Painel financeiro e de operação da plataforma.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />)}
      </div>

      <div className="card !p-0 overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold">Pedidos de Reembolso</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Garantia de 7 dias: aguardando reembolso (site ainda no ar) → reembolsado (site desativado, dados preservados).
            </p>
          </div>
          <Link href="/admin/financeiro" className="text-xs text-[#1d5c3a] underline">
            Ver financeiro →
          </Link>
        </div>
        {refundDisplay.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400">Nenhum pedido de reembolso.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Data</th><th>Usuário</th><th>Site</th><th>Valor</th><th>Status</th><th>MP</th></tr>
              </thead>
              <tbody>
                {refundDisplay.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs">{formatDateTime(r.created_at)}</td>
                    <td className="text-xs break-all">{r.email}</td>
                    <td className="text-xs">/{r.slug} ({r.site_status})</td>
                    <td>{formatBRL(r.amount_cents)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-xs text-gray-400">{r.mercadopago_payment_id || "—"}</td>
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
