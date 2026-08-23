import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoProdutos } from "@/components/demo/PainelDemoProdutos";
import RealPage from "./real-page";

export default async function CrmProdutosPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoProdutos />;
  return <RealPage />;
}
