import { getPainelContext } from "@/lib/demo/painel-context";
import { AffiliateDashboard } from "@/components/affiliate/AffiliateDashboard";

export const dynamic = "force-dynamic";

export default async function AfiliadosPage() {
  const { isDemo, ctx } = await getPainelContext();
  if (!ctx || !ctx.profile) return null;

  // "Site ativo" = site_status='active' do tenant do próprio usuário.
  // Essa é a regra de "site pessoal no ar" usada em todo o app.
  const siteActive = ctx.tenant?.site_status === "active";

  return (
    <AffiliateDashboard
      userId={ctx.profile.user_id}
      userEmail={ctx.profile.email}
      userName={ctx.profile.name || ""}
      tenantSlug={ctx.tenant?.slug || ""}
      isDemo={isDemo}
      siteActive={siteActive}
    />
  );
}