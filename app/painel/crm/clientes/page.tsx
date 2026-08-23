import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoClientes } from "@/components/demo/PainelDemoClientes";
import RealPage from "./real-page";

export default async function CrmClientesPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoClientes />;
  return <RealPage />;
}
