import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoPagamentos } from "@/components/demo/PainelDemoPagamentos";
import RealPage from "./real-page";

export default async function PagamentosPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoPagamentos />;
  return <RealPage />;
}
