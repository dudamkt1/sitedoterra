import { getPainelContext } from "@/lib/demo/painel-context";
import RealPage from "./real-page";

export default async function CrmClientDetailPage(props: { params: { id: string } }) {
  const { isDemo, ctx } = await getPainelContext();
  if (!ctx) return null;
  if (isDemo) return <RealPage demoCtx={ctx as never} params={props.params} />;
  return <RealPage params={props.params} />;
}
