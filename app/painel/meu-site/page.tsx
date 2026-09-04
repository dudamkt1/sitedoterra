import Link from "next/link";
import { getPainelContext } from "@/lib/demo/painel-context";
import { SectionTitle } from "@/components/dashboard/ui";
import { getPublicBaseUrl } from "@/lib/public-url";
import { getAffiliateSettings } from "@/lib/affiliate";

export default async function MeuSitePage() {
  const { isDemo, ctx } = await getPainelContext();
  if (!ctx) return null;

  const siteData = (ctx.tenant?.site_data || {}) as Record<string, any>;
  const appUrl = getPublicBaseUrl();
  const siteActive = ctx.tenant?.site_status === "active";
  const affiliateSettings = await getAffiliateSettings();
  const allowInactiveSite = affiliateSettings?.allow_inactive_site_affiliate !== false;
  const programActive = affiliateSettings?.program_active !== false;
  const userId = ctx.profile?.user_id || "";
  const tenantSlug = ctx.tenant?.slug || "";

  // Lazy-load dos componentes reais
  const { SiteManager } = await import("@/components/dashboard/SiteManager");
  const { SiteSectionsManager } = await import("@/components/dashboard/SiteSectionsManager");

  const referralLink = tenantSlug && userId
    ? `${appUrl}/${tenantSlug.startsWith("aguardando-") ? "" : tenantSlug}?ref=${userId}`.replace(/\/\?/, "/?")
    : "";

  return (
    <div className="space-y-8">
      <SectionTitle sub="Configure o nome de usuário, o conteúdo e as seções do seu site.">
        Meu Site
      </SectionTitle>

      {/* Card contextual — só aparece quando o site do próprio afiliado não
          está ativo. Explica o status do site + como isso impacta o programa
          de afiliados (link continua ou fica bloqueado conforme a flag
          global controlada pelo Super Admin). */}
      {!siteActive && programActive && (
        <div
          className={`rounded-2xl border p-5 ${
            allowInactiveSite
              ? "bg-amber-50 border-amber-200"
              : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">
                🌱 Seu site ainda não está ativado
              </p>
              {allowInactiveSite ? (
                <p className="text-sm text-gray-700 mt-1.5">
                  Mas você já pode divulgar seu link de afiliado e indicar novos clientes.
                  Ative seu site para disponibilizar sua própria página profissional.
                </p>
              ) : (
                <p className="text-sm text-gray-700 mt-1.5">
                  No momento, as indicações de afiliados estão disponíveis somente para
                  usuários com site ativo. Ative seu site para começar a divulgar seu
                  link de afiliado.
                </p>
              )}
              {referralLink && allowInactiveSite && (
                <p className="text-xs text-gray-600 mt-3 break-all">
                  Seu link:{" "}
                  <code className="bg-white/60 px-2 py-1 rounded border border-amber-200">
                    {referralLink}
                  </code>
                </p>
              )}
            </div>
            <Link
              href="/painel/assinatura"
              className="btn btn-primary shrink-0"
            >
              🚀 Ativar meu site
            </Link>
          </div>
        </div>
      )}

      <SiteManager
        slug={ctx.tenant?.slug || ""}
        pendingSlug={ctx.tenant?.slug?.startsWith("aguardando-") ?? true}
        siteData={siteData}
        siteStatus={ctx.tenant?.site_status || "pending"}
        appUrl={appUrl}
        hasSubscription={Boolean(ctx.subscription)}
        lockUrl={isDemo ? true : undefined}
      />
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="card-title mb-1">Minha Home</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Ative, desative e personalize as seções da sua página. As opções disponíveis seguem as regras da plataforma.
        </p>
        <SiteSectionsManager
          slug={ctx.tenant?.slug || ""}
          appUrl={appUrl}
        />
        <div className="mt-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-sm text-[#166534]">
            <b>📅 Agendamento</b> agora tem área própria — edite dias/horários livres, bloqueios e veja todos os compromissos em um só lugar.
          </p>
          <Link href="/painel/agendamentos" className="btn btn-primary !py-2 !px-4 text-xs shrink-0">
            Ir para Agendamentos →
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Em <b>Meu Site</b> a seção “Agendamento” fica apenas com <b>ativar/desativar</b>. Toda edição rápida está em <b>Agendamentos</b>.
        </p>
      </div>
    </div>
  );
}
