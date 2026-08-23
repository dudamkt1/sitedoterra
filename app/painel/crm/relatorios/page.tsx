import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoRelatorios } from "@/components/demo/PainelDemoRelatorios";
import RealPage from "./real-page";

export default async function CrmRelatoriosPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoRelatorios />;
  return <RealPage />;
}
