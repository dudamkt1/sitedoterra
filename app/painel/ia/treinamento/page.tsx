import { getDashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { AiTraining } from "@/components/dashboard/AiTraining";

export default async function IaTreinamentoPage() {
  const ctx = await getDashboardContext();
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