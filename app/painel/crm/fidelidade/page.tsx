import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoFidelidade } from "@/components/demo/PainelDemoFidelidade";
import RealPage from "./real-page";

export default async function CrmFidelidadePage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoFidelidade />;
  return <RealPage />;
}
