import { getDashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { AiCenter } from "@/components/dashboard/AiCenter";

export default async function IaPage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;

  return (
    <div>
      <SectionTitle sub="Crie conteúdos para divulgar seus produtos, negócio, redes sociais e site. IA gratuita configurável, com foco no universo doTERRA e óleos essenciais.">
        Central de IA para Conteúdo doTERRA
      </SectionTitle>
      <AiCenter isSuperAdmin={ctx.isSuperAdmin} />
    </div>
  );
}
