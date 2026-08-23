import { getPainelContext } from "@/lib/demo/painel-context";
import { SectionTitle } from "@/components/dashboard/ui";
import { PainelDemoMeuSite } from "@/components/demo/PainelDemoMeuSite";

export default async function MeuSitePage() {
  const { isDemo, ctx } = await getPainelContext();
  if (!ctx) return null;

  if (isDemo) {
    return (
      <div className="space-y-8">
        <SectionTitle sub="Personalize a aparência e as seções do seu site (somente neste dispositivo).">
          Meu Site
        </SectionTitle>
        <PainelDemoMeuSite />
      </div>
    );
  }

  const siteData = (ctx.tenant?.site_data || {}) as Record<string, any>;

  // Lazy-load the real components to keep the demo path self-contained
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
        appUrl={process.env.NEXT_PUBLIC_APP_URL || ""}
        hasSubscription={Boolean(ctx.subscription)}
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
          appUrl={process.env.NEXT_PUBLIC_APP_URL || ""}
        />
      </div>
    </div>
  );
}
