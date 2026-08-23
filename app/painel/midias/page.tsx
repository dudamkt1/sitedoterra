import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoMidias } from "@/components/demo/PainelDemoMidias";
import RealPage from "./real-page";

export default async function MidiasPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoMidias />;
  return <RealPage />;
}
