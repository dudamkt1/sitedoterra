import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoConfiguracoes } from "@/components/demo/PainelDemoConfiguracoes";
import RealPage from "./real-page";

export default async function CrmConfiguracoesPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoConfiguracoes />;
  return <RealPage />;
}
