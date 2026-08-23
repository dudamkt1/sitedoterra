import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoIa } from "@/components/demo/PainelDemoIa";
import RealPage from "./real-page";

export default async function IaPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoIa />;
  return <RealPage />;
}
