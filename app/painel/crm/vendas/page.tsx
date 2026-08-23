import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoVendas } from "@/components/demo/PainelDemoVendas";
import RealPage from "./real-page";

export default async function CrmVendasPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoVendas />;
  return <RealPage />;
}
