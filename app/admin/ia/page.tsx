import { createAdminClient } from "@/lib/supabase/admin";
import { AiToolsAdmin } from "@/components/admin/AiToolsAdmin";
import { AiTemplatesAdmin } from "@/components/admin/AiTemplatesAdmin";
import { AiUsageStats } from "@/components/admin/AiUsageStats";
import type { AiTool, AiTemplate } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminIaPage() {
  let tools: AiTool[] = [];
  let templates: AiTemplate[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    const [t, tpl] = await Promise.all([
      admin.from("ai_tools").select("*").order("sort_order", { ascending: true }),
      admin.from("ai_templates").select("*").order("sort_order", { ascending: true }),
    ]);
    if (!t.error && t.data) tools = t.data as unknown as AiTool[];
    if (!tpl.error && tpl.data) templates = tpl.data as unknown as AiTemplate[];
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Central de IA</h1>
        <p className="text-sm text-gray-500">
          Controle as ferramentas de criação de conteúdo, os templates para redes sociais e acompanhe as estatísticas de uso. As alterações aparecem imediatamente para os usuários.
        </p>
      </div>

      <AiUsageStats />

      <div className="mt-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="card-title mb-1">Ferramentas de IA</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Ative/desative, renomeie, reordene e edite as instruções (base prompt) de cada ferramenta. Os campos de formulário de cada ferramenta são definidos em código.
        </p>
        <AiToolsAdmin initialTools={tools} />
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="card-title mb-1">Templates para redes sociais</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Crie, edite, remova e ative/desative templates. Cada template define os campos que o usuário pode personalizar (texto, cores, imagem, logo, posição).
        </p>
        <AiTemplatesAdmin initialTemplates={templates} />
      </div>
    </div>
  );
}