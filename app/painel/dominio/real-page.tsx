import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { DomainManager } from "@/components/dashboard/DomainManager";
import { getPublicBaseUrl } from "@/lib/public-url";

export default async function DominioPage(p: { demoCtx?: DashboardContext }) {
  const ctx = p.demoCtx ?? (await getDashboardContext());
  if (!ctx?.profile) return null;

  return (
    <div>
      <SectionTitle sub="Conecte seu próprio domínio ao seu site. O site continua o mesmo — só muda o endereço.">
        Domínio Personalizado
      </SectionTitle>
      <DomainManager
        domains={ctx.domains as any}
        slug={ctx.tenant?.slug || ""}
        appUrl={getPublicBaseUrl()}
      />
    </div>
  );
}
