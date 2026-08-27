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
  const { BookingAppointmentsManager } = await import("@/components/dashboard/BookingAppointmentsManager");

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
      </div>
      <div>
        <BookingAppointmentsManager />
        <p className="text-xs text-gray-400 mt-3 px-1">
          <b>Melhor forma sugerida:</b> este controle vive dentro de <b>Meu Site → Agendamento</b> e também respeita seu calendário público. Cadastre cada consulta assim que fechar no WhatsApp; use os filtros <b>Hoje</b> e <b>Próximos</b> como lembrete diário. Status <b>Realizada / Cancelada / Faltou</b> viram histórico para relatórios e para bloquear horários automaticamente (em breve: sugerimos vincular agendamentos realizados aos <b>Horários ocupados</b> da agenda).
        </p>
      </div>
    </div>
  );
}
