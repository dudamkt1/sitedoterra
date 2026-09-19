import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { SupportMaterials } from "@/components/dashboard/SupportMaterials";

export const dynamic = "force-dynamic";

export default async function PainelMateriaisApoioPage(p: { demoCtx?: DashboardContext }) {
  const ctx = p.demoCtx ?? (await getDashboardContext());
  if (!ctx?.profile) return null;

  return (
    <div>
      <SectionTitle sub="Crie e gerencie subcategorias com imagem, título, descrição e link externo para organizar seus materiais de apoio.">
        Materiais de Apoio
      </SectionTitle>
      <SupportMaterials />
    </div>
  );
}