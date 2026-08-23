import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoFinanceiro } from "@/components/demo/PainelDemoFinanceiro";
import RealPage from "./real-page";

export default async function CrmFinanceiroPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoFinanceiro />;
  return <RealPage />;
}
