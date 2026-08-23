import type { DashboardContext } from "@/lib/auth";
import CrmNav from "@/components/crm/CrmNav";
import CrmClientDetail from "@/components/crm/CrmClientDetail";

export default async function CrmClientDetailPage(
  p: { demoCtx?: DashboardContext; params?: { id: string } }
) {
  if (!p.demoCtx?.profile) return null;
  const id = p.params?.id;

  return (
    <div>
      <CrmNav modules={{}} activePrefix="/painel/crm/clientes" />
      <CrmClientDetail clientId={id || ""} />
    </div>
  );
}
