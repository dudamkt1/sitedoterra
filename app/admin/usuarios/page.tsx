import { createAdminClient } from "@/lib/supabase/admin";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const admin = createAdminClient();

  const [{ data: profiles }, { data: tenants }, { data: subs }, { data: domains }, { data: plans }] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("tenants").select("*"),
    admin.from("subscriptions").select("*"),
    admin.from("domains").select("*"),
    admin.from("plans").select("*"),
  ]);

  const tenantByUser = new Map((tenants || []).map((t: any) => [t.user_id, t]));
  const subByTenant = new Map((subs || []).map((s: any) => [s.tenant_id, s]));
  const domainsByTenant = new Map<string, any[]>();
  for (const d of domains || []) {
    const list = domainsByTenant.get(d.tenant_id) || [];
    list.push(d);
    domainsByTenant.set(d.tenant_id, list);
  }
  const plansById = new Map((plans || []).map((p: any) => [p.id, p]));

  const rows = (profiles || []).map((p: any) => {
    const t = tenantByUser.get(p.user_id);
    const sub = t ? subByTenant.get(t.id) : null;
    const doms = t ? domainsByTenant.get(t.id) || [] : [];
    return {
      profile: p,
      tenant: t || null,
      subscription: sub ? { ...sub, plan: sub.plan_id ? plansById.get(sub.plan_id) || null : null } : null,
      domains: doms,
      registeredAt: formatDate(p.created_at),
      activatedAt: formatDate(p.activated_at),
      nextBilling: sub?.next_billing_at ? formatDate(sub.next_billing_at) : "—",
      url: t ? `/${t.slug}` : "—",
    };
  });

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Usuários</h1>
      <p className="text-sm text-gray-500 mb-8">Todos os clientes da plataforma com status, planos, domínios e ações.</p>
      <AdminUsers rows={rows} plans={(plans || []) as any[]} />
    </div>
  );
}
