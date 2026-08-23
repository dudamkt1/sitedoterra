import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoIaTreinamento } from "@/components/demo/PainelDemoIaTreinamento";
import RealPage from "./real-page";

export default async function IaTreinamentoPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoIaTreinamento />;
  return <RealPage />;
}
