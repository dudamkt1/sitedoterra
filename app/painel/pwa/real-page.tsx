import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { PwaManager } from "@/components/dashboard/PwaManager";

export const dynamic = "force-dynamic";

export default async function PwaRealPage(p: { demoCtx?: DashboardContext }) {
  const ctx = p.demoCtx ?? (await getDashboardContext());
  if (!ctx?.profile) return null;

  return (
    <div>
      <SectionTitle sub="Transforme sua página em um aplicativo instalável no celular dos seus clientes — com seu nome, suas cores e seu ícone.">
        PWA / Meu Aplicativo
      </SectionTitle>
      <PwaManager />
    </div>
  );
}
