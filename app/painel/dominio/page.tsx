import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoDominio } from "@/components/demo/PainelDemoDominio";
import RealPage from "./real-page";

export default async function DominioPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoDominio />;
  return <RealPage />;
}
