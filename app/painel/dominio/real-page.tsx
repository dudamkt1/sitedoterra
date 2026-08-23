import { getDashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { DomainManager } from "@/components/dashboard/DomainManager";

export default async function DominioPage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;

  return (
    <div>
      <SectionTitle sub="Conecte seu próprio domínio ao seu site. O site continua o mesmo — só muda o endereço.">
        Domínio Personalizado
      </SectionTitle>
      <DomainManager
        domains={ctx.domains as any}
        slug={ctx.tenant?.slug || ""}
        appUrl={process.env.NEXT_PUBLIC_APP_URL || ""}
      />
    </div>
  );
}
