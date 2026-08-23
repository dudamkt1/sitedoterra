import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoTarefas } from "@/components/demo/PainelDemoTarefas";
import RealPage from "./real-page";

export default async function CrmTarefasPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoTarefas />;
  return <RealPage />;
}
