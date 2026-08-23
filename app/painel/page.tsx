import { redirect } from "next/navigation";
import Link from "next/link";
import { getPainelContext } from "@/lib/demo/painel-context";
import { getSiteAccess } from "@/lib/access";
import { formatBRL, formatDate } from "@/lib/utils";
import { getActiveOffer } from "@/lib/commercial";
import { StatCard, StatusBadge } from "@/components/dashboard/ui";

export default async function PainelHome() {
  const { ctx: rawCtx } = await getPainelContext();
  if (!rawCtx) return null;
  const ctx = rawCtx as never as import("@/lib/auth").DashboardContext;

  const { profile, tenant, subscription, domains } = ctx;
  if (!profile) return null;
  const offer = await getActiveOffer();
  const siteAccess = getSiteAccess({
    accountStatus: profile.status,
    siteStatus: tenant?.site_status || "pending",
    subscriptionStatus: subscription?.status || "awaiting_activation",
    blocked: profile.status === "blocked",
    billingEnabled: tenant?.monthly_billing_enabled !== false,
  });

  const publicUrl = tenant ? `/${tenant.slug}` : null;
  const planName = subscription?.plan?.name || offer?.name || "Sem plano";
  const nextBilling = subscription?.next_billing_at || subscription?.current_period_end;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Olá, {profile.name?.split(" ")[0] || "bem-vindo(a)"} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Aqui está a situação do seu site e da sua assinatura.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Status do site"
          value={siteAccess === "available" ? "No ar" : "Suspenso"}
          icon={siteAccess === "available" ? "🟢" : "🔴"}
          sub={publicUrl ? `URL: /${tenant?.slug}` : "Configure seu nome de usuário"}
        />
        <StatCard
          label="Plano"
          value={planName}
          icon="📦"
          sub={offer ? `${formatBRL(offer.activation_price_cents)} ativação + ${formatBRL(offer.monthly_price_cents)}/mês` : "Escolha um plano"}
        />
        <StatCard
          label="Assinatura"
          value={subscription ? <StatusBadge status={subscription.status} /> : "Sem assinatura"}
          icon="💳"
          sub={nextBilling ? `Próxima cobrança: ${formatDate(nextBilling)}` : "—"}
        />
        <StatCard
          label="Domínio próprio"
          value={domains.length > 0 ? domains[0].domain : "Não conectado"}
          icon="🔗"
          sub={domains.length > 0 ? <StatusBadge status={domains[0].status} /> : "Conecte seu domínio no painel"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">Meu Site</h2>
            <Link href="/painel/meu-site" className="btn btn-outline !py-2 !px-4 text-xs">
              Configurar
            </Link>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex justify-between"><span>URL pública</span><strong className="text-[#1d5c3a]">{publicUrl || "—"}</strong></li>
            <li className="flex justify-between"><span>Status</span><StatusBadge status={siteAccess === "available" ? "active" : "suspended"} /></li>
            <li className="flex justify-between"><span>Domínio personalizado</span><strong>{domains[0]?.domain || "—"}</strong></li>
          </ul>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">Próximos passos</h2>
          </div>
          {!subscription ? (
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <span className="badge badge-yellow">1</span>
                <span><Link href="/painel/assinatura" className="text-[#1d5c3a] underline">Escolha seu plano</Link> e ative sua assinatura.</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <span className="badge badge-gray">2</span>
                <span>Escolha seu nome de usuário para gerar sua URL.</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <span className="badge badge-gray">3</span>
                <span>Configure seu site e conecte seu domínio próprio.</span>
              </li>
            </ul>
          ) : (
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <span className="badge badge-green">✓</span>
                <span>Plano <strong>{planName}</strong> ativo.</span>
              </li>
              {!tenant?.slug || tenant.slug.startsWith("aguardando-") ? (
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="badge badge-yellow">!</span>
                  <span><Link href="/painel/meu-site" className="text-[#1d5c3a] underline">Defina seu nome de usuário</Link> para publicar sua URL.</span>
                </li>
              ) : (
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="badge badge-green">✓</span>
                  <span>Seu site está em <Link href={`/${tenant.slug}`} target="_blank" className="text-[#1d5c3a] underline">/{tenant.slug} ↗</Link></span>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
