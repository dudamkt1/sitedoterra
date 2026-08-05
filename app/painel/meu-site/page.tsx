import { getDashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { SiteManager } from "@/components/dashboard/SiteManager";

export default async function MeuSitePage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;

  const siteData = (ctx.tenant?.site_data || {}) as Record<string, any>;

  return (
    <div>
      <SectionTitle sub="Configure o nome de usuário, o conteúdo e as informações do seu site.">
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
    </div>
  );
}
