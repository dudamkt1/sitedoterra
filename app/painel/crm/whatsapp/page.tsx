import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoWhatsapp } from "@/components/demo/PainelDemoWhatsapp";
import RealPage from "./real-page";

export default async function CrmWhatsAppPage() {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoWhatsapp />;
  return <RealPage />;
}
