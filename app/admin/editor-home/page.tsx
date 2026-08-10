import { createAdminClient } from "@/lib/supabase/admin";
import { HomeEditor } from "@/components/admin/HomeEditor";
import type { SiteSection } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminEditorHomePage() {
  let sections: SiteSection[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    const { data, error } = await admin.from("site_sections").select("*").order("sort_order", { ascending: true });
    if (!error && data) sections = data as unknown as SiteSection[];
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Editor da Home</h1>
        <p className="text-sm text-gray-500">
          Controle global da estrutura da HOME. Crie, edite, duplique, ordene e defina permissões de cada seção.
          As alterações aqui valem para todos os sites. A ordem salva é refletida automaticamente na página pública.
        </p>
      </div>
      <HomeEditor initialSections={sections} appUrl={process.env.NEXT_PUBLIC_APP_URL || ""} />
    </div>
  );
}
