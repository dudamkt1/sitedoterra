import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoCobrancas } from "@/components/demo/PainelDemoCobrancas";
import RealPage from "./real-page";

export default async function CrmCobrancasPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoCobrancas />;
  return <RealPage />;
}
