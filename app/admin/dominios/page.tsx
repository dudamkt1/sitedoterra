import { createAdminClient } from "@/lib/supabase/admin";
import { AdminDomains } from "@/components/admin/AdminDomains";

export const dynamic = "force-dynamic";

export default async function AdminDominiosPage() {
  const admin = createAdminClient();

  const [{ data: domains }, { data: tenants }, { data: profiles }] = await Promise.all([
    admin.from("domains").select("*").order("created_at", { ascending: false }),
    admin.from("tenants").select("id, user_id, slug"),
    admin.from("profiles").select("user_id, email, name"),
  ]);

  const tenantById = new Map((tenants || []).map((t: any) => [t.id, t]));
  const userById = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  const rows = (domains || []).map((d: any) => {
    const t = tenantById.get(d.tenant_id);
    const u = t ? userById.get(t.user_id) : null;
    return { ...d, slug: t?.slug || null, email: u?.email || null, name: u?.name || null };
  });

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Domínios</h1>
      <p className="text-sm text-gray-500 mb-8">Todos os domínios personalizados conectados à plataforma.</p>
      <AdminDomains rows={rows as any[]} />
    </div>
  );
}
