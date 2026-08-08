import { createAdminClient } from "@/lib/supabase/admin";
import { isSitePublic } from "@/lib/access";
import type { PublicTenant, Subscription } from "@/types";

/**
 * Resolve um tenant pelo slug (URL padrão dominio.com/slug)
 * ou por domínio personalizado (hostname).
 *
 * Retorna null quando o site não é público (suspenso/inexistente).
 */
function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function getPublicTenantBySlug(slug: string): Promise<PublicTenant | null> {
  if (!hasSupabaseEnv()) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_public_tenant_by_slug", { p_slug: slug });
  if (error) return null;
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  return (Array.isArray(data) ? data[0] : data) as PublicTenant;
}

export async function getPublicTenantByDomain(hostname: string): Promise<PublicTenant | null> {
  if (!hasSupabaseEnv()) return null;
  const domain = hostname.toLowerCase().replace(/^www\./, "");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_public_tenant_by_domain", { p_domain: domain });
  if (error) return null;
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  return (Array.isArray(data) ? data[0] : data) as PublicTenant;
}

/**
 * Resolve o tenant e devolve o status de acesso usando a regra central.
 * Retorna { tenant, access } — use para renderizar o site ou a página de suspensão.
 */
export async function resolveTenantAccess(opts: { slug?: string; hostname?: string }) {
  let tenantId: string | null = null;
  let tenant: PublicTenant | null = null;

  if (opts.slug) {
    tenant = await getPublicTenantBySlug(opts.slug);
  } else if (opts.hostname) {
    tenant = await getPublicTenantByDomain(opts.hostname);
  }

  if (!tenant) {
    return { tenant: null, access: "suspended" as const, subscription: null };
  }
  tenantId = tenant.tenant_id;

  const admin = createAdminClient();

  // Busca assinatura ativa para checagem precisa de acesso
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return {
    tenant,
    access: isSitePublic(
      "active",
      tenant.site_status as "active" | "pending" | "suspended",
      (sub?.status as Subscription["status"]) || "awaiting_activation",
      false
    )
      ? ("available" as const)
      : ("suspended" as const),
    subscription: (sub as Subscription) || null,
  };
}
