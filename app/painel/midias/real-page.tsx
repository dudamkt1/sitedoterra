import { getDashboardContext } from "@/lib/auth";
import { SectionTitle } from "@/components/dashboard/ui";
import { MediaLibrary } from "@/components/media/MediaLibrary";

export const dynamic = "force-dynamic";

export default async function PainelMidiasPage() {
  const ctx = await getDashboardContext();
  if (!ctx?.profile) return null;

  return (
    <div>
      <SectionTitle sub="Todas as suas imagens são armazenadas no Cloudflare R2. Use a biblioteca para enviar, gerenciar e copiar URLs das suas mídias.">
        Minha Biblioteca de Mídia
      </SectionTitle>
      <MediaLibrary scope="tenant" />
    </div>
  );
}
