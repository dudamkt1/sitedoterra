import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoCrmHome } from "@/components/demo/PainelDemoCrmHome";
import RealPage from "./real-page";

export default async function CrmDashboardPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoCrmHome />;
  return <RealPage />;
}
