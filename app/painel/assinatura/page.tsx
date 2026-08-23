import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoAssinatura } from "@/components/demo/PainelDemoAssinatura";
import RealPage from "./real-page";

export default async function AssinaturaPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoAssinatura />;
  return <RealPage />;
}
