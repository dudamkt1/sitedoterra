import { getDashboardContext, type DashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { MediaLibrary } from "@/components/media/MediaLibrary";

export const dynamic = "force-dynamic";

export default async function PainelMidiasPage(p: { demoCtx?: DashboardContext }) {
  const ctx = p.demoCtx ?? (await getDashboardContext());
  if (!ctx?.profile) return null;

  return (
    <div>
      <SectionTitle sub="Todas as suas imagens ficam salvas na sua biblioteca. Use-a para enviar, gerenciar e copiar URLs das suas mídias.">
        Minha Biblioteca de Mídia
      </SectionTitle>
      <MediaLibrary scope="tenant" />
    </div>
  );
}
