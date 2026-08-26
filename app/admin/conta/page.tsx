import { createAdminClient } from "@/lib/supabase/admin";
import { AdminConta } from "@/components/admin/AdminConta";

export const dynamic = "force-dynamic";

export default async function AdminContaPage() {
  const admin = createAdminClient();

  const [{ data: profiles }, { data: tenants }, { data: subs }] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("tenants").select("*"),
    admin.from("subscriptions").select("*"),
  ]);

  const tenantByUser = new Map((tenants || []).map((t: any) => [t.user_id, t]));
  const subByTenant = new Map((subs || []).map((s: any) => [s.tenant_id, s]));

  const rows = (profiles || []).map((p: any) => {
    const t = tenantByUser.get(p.user_id);
    const sub = t ? subByTenant.get(t.id) : null;
    return { profile: p, tenant: t || null, subscription: sub || null };
  });

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Contas</h1>
      <p className="text-sm text-gray-500 mb-8">Gerencie nome, e-mail, telefone e senha de cada conta. Informações gerais como status, cadastro e ativação são exibidas somente para leitura.</p>
      <AdminConta rows={rows} />
    </div>
  );
}
