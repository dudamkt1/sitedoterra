import { getPainelContext } from "@/lib/demo/painel-context";
import { PainelDemoClienteDetalhe } from "@/components/demo/PainelDemoClienteDetalhe";
import RealPage from "./real-page";

export default async function CrmClientDetailPage(props: { params: { id: string } }) {
  const { isDemo } = await getPainelContext();
  if (isDemo) return <PainelDemoClienteDetalhe clientId={props.params.id} />;
  return <RealPage {...props} />;
}
