import Link from "next/link";
import { getPainelContext } from "@/lib/demo/painel-context";
import { SectionTitle } from "@/components/dashboard/ui";
import { getPublicBaseUrl } from "@/lib/public-url";

export default async function MeuSitePage() {
  const { isDemo, ctx } = await getPainelContext();
  if (!ctx) return null;

  const siteData = (ctx.tenant?.site_data || {}) as Record<string, any>;
  const appUrl = getPublicBaseUrl();

  // Lazy-load dos componentes reais
  const { SiteManager } = await import("@/components/dashboard/SiteManager");
  const { SiteSectionsManager } = await import("@/components/dashboard/SiteSectionsManager");

  return (
    <div className="space-y-8">
      <SectionTitle sub="Configure o nome de usuário, o conteúdo e as seções do seu site.">
        Meu Site
      </SectionTitle>
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
