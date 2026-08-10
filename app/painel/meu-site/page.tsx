import { getDashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { SiteManager } from "@/components/dashboard/SiteManager";
import { SiteSectionsManager } from "@/components/dashboard/SiteSectionsManager";

export default async function MeuSitePage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;

  const siteData = (ctx.tenant?.site_data || {}) as Record<string, any>;

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
