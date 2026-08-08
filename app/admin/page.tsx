import { createAdminClient } from "@/lib/supabase/admin";
import { StatCard } from "@/components/dashboard/ui";
import { formatBRL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const admin = createAdminClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [payments, subs, tenants, profiles, monthPayments, domains] = await Promise.all([
    admin.from("payments").select("amount_cents, type, status, created_at"),
    admin.from("subscriptions").select("status, plan:plan_id(monthly_price_cents)"),
    admin.from("tenants").select("site_status"),
    admin.from("profiles").select("status, created_at"),
    admin.from("payments").select("amount_cents, type, status").gte("created_at", monthStart),
    admin.from("domains").select("status"),
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
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Visão geral</h1>
      <p className="text-sm text-gray-500 mb-8">Painel financeiro e de operação da plataforma.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />)}
      </div>
    </div>
  );
}
