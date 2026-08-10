import { getDashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { AiPanel } from "@/components/dashboard/AiPanel";

export default async function IaPage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;

  return (
    <div>
      <SectionTitle sub="Configure sua IA gratuita e gere conteúdos para o seu site. A chave fica armazenada com segurança e nunca é exposta no frontend.">
        IA para seu site
      </SectionTitle>
      <AiPanel isSuperAdmin={ctx.isSuperAdmin} />
    </div>
  );
}
