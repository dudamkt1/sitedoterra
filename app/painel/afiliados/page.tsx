import { getPainelContext } from "@/lib/demo/painel-context";
import { AffiliateDashboard } from "@/components/affiliate/AffiliateDashboard";

export default async function AfiliadosPage() {
  const { isDemo, ctx } = await getPainelContext();
  if (!ctx) return null;

  return (
    <AffiliateDashboard
      userId={ctx.profile.user_id}
      userEmail={ctx.profile.email}
      userName={ctx.profile.name || ""}
      tenantSlug={ctx.tenant?.slug || ""}
      isDemo={isDemo}
    />
  );
}