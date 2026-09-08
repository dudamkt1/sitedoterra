import { createAdminClient } from "@/lib/supabase/admin";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminUsuariosPage() {
  const admin = createAdminClient();
  const actor = await getCurrentUser();

  const [{ data: profiles }, { data: tenants }, { data: subs }, { data: domains }, { data: plans }, { data: payments }] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("tenants").select("*"),
    admin.from("subscriptions").select("*"),
    admin.from("domains").select("*"),
    admin.from("plans").select("*"),
    admin.from("payments").select("*"),
  ]);

  // ---- Sincronização total com o Supabase Auth ----
  // A lista de usuários exibida é a UNIÃO entre auth.users e public.profiles,
  // para que nenhuma conta real fique invisível no /admin/usuarios
  // (ex.: usuário criado no Auth mas sem profile por falha de trigger).
  // Usuários órfãos ganham um profile/tenant de cura automática (heal).
  type AuthUser = {
    id: string;
    email?: string | null;
    created_at?: string;
    banned_until?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };
  let authUsers: AuthUser[] = [];
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data?.users?.length) break;
      authUsers = authUsers.concat(data.users as unknown as AuthUser[]);
      if (data.users.length < 1000) break;
    }
  } catch (e) {
    console.error("[admin/usuarios] listUsers falhou:", e);
  }

  const profileByUser = new Map(((profiles || []) as any[]).map((p: any) => [p.user_id, p]));

  // Auto-heal: cria profile ausente para contas que existem no Auth.
  for (const u of authUsers) {
    if (!u?.id || profileByUser.has(u.id)) continue;
    const meta = (u.user_metadata || {}) as Record<string, unknown>;
    const email = typeof u.email === "string" ? u.email.toLowerCase() : "";
    const name =
      (typeof meta.name === "string" && meta.name) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      null;
    // Banido no Auth mas sem profile => status bloqueado; senão pendente.
    const status = u.banned_until && u.banned_until !== "none" ? "blocked" : "pending_activation";
    const { data: created } = await admin
      .from("profiles")
      .upsert(
        {
          user_id: u.id,
          email: email || `sem-email-${u.id.slice(0, 8)}@invalido.local`,
          name,
          role: "user",
          status,
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .maybeSingle();
    if (created) profileByUser.set(u.id, created);
    else {
      // Fallback em memória (nunca deixa a conta invisível, mesmo se o upsert falhar).
      profileByUser.set(u.id, {
        user_id: u.id,
        email: email || "—",
        name,
        phone: null,
        role: "user",
        status,
        created_at: u.created_at || new Date().toISOString(),
        activated_at: null,
        _missing: true,
      });
    }
  }

  // Garante tenant para todo profile (contas sem site ainda exibem ações).
  const tenantByUser = new Map(((tenants || []) as any[]).map((t: any) => [t.user_id, t]));
  for (const userId of Array.from(profileByUser.keys())) {
    if (tenantByUser.has(userId)) continue;
    const prefix = String(userId).replace(/-/g, "").slice(0, 10);
    let slug = `aguardando-${prefix}`;
    const { data: clash } = await admin.from("tenants").select("slug").eq("slug", slug).maybeSingle();
    if (clash) slug = `aguardando-${prefix}-${Date.now().toString(36)}`;
    const { data: created } = await admin
      .from("tenants")
      .insert({ user_id: userId, slug, site_name: null, site_status: "pending", settings: {} })
      .select("*")
      .maybeSingle();
    if (created) tenantByUser.set(userId, created);
  }
  const subByTenant = new Map((subs || []).map((s: any) => [s.tenant_id, s]));
  const domainsByTenant = new Map<string, any[]>();
  for (const d of domains || []) {
    const list = domainsByTenant.get(d.tenant_id) || [];
    list.push(d);
    domainsByTenant.set(d.tenant_id, list);
  }
  const plansById = new Map((plans || []).map((p: any) => [p.id, p]));
  const activationByTenant = new Map<string, any>();
  for (const pay of (payments || []) as any[]) {
    if (pay.type !== "activation" || pay.status !== "succeeded") continue;
    if (!activationByTenant.has(pay.tenant_id)) activationByTenant.set(pay.tenant_id, pay);
  }

  const rows = Array.from(profileByUser.values()).map((p: any) => {
    const t = tenantByUser.get(p.user_id) || null;
    const sub = t ? subByTenant.get(t.id) : null;
    const doms = t ? domainsByTenant.get(t.id) || [] : [];
    const activation = t ? activationByTenant.get(t.id) || null : null;
    return {
      profile: p,
      tenant: t,
      subscription: sub ? { ...sub, plan: sub.plan_id ? plansById.get(sub.plan_id) || null : null } : null,
      activation,
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
      <AdminUsers rows={rows} plans={(plans || []) as any[]} currentUserId={actor?.id || null} />
    </div>
  );
}
