import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { AiTraining } from "@/components/dashboard/AiTraining";

export default async function IaTreinamentoPage(p: { demoCtx?: DashboardContext }) {
  const ctx = p.demoCtx ?? (await getDashboardContext());
  if (!ctx?.profile) return null;

  return (
    <div>
      <SectionTitle sub="Cadastre perguntas e respostas pré-prontas. Elas são usadas com prioridade pela assistente 'Especialista IA doTERRA' na HOME do seu site, garantindo que o atendimento reflita seu tom e seus conhecimentos.">
        Treinar IA do site
      </SectionTitle>
      <AiTraining />
    </div>
  );
}
