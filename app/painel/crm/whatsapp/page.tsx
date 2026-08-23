import { getPainelContext } from "@/lib/demo/painel-context";
import RealPage from "./real-page";

export default async function CrmWhatsAppPage() {
  const { isDemo, ctx } = await getPainelContext();
  if (!ctx) return null;
  return <RealPage demoCtx={isDemo ? (ctx as never) : undefined} />;
}
