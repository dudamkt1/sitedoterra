import { createAdminClient } from "@/lib/supabase/admin";
import { AiProvidersAdmin } from "@/components/admin/AiProvidersAdmin";
import type { AiProvider } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminEditorIaPage() {
  let providers: AiProvider[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    const { data, error } = await admin.from("ai_providers").select("*").order("sort_order", { ascending: true });
    if (!error && data) providers = data as unknown as AiProvider[];
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Provedores de IA</h1>
        <p className="text-sm text-gray-500">
          Controle quais provedores gratuitos aparecem, a documentação, os limites informativos e as instruções para os usuários.
        </p>
      </div>
      <AiProvidersAdmin initialProviders={providers} />
    </div>
  );
}
