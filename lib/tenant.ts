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

// Cache 60s para slugs públicos (HOME e checkout batem no mesmo slug repetidamente)
const tenantBySlugCache = new Map<string, { data: PublicTenant | null; ts: number }>();

export async function getPublicTenantBySlug(slug: string): Promise<PublicTenant | null> {
  if (!hasSupabaseEnv()) return null;
  const cached = tenantBySlugCache.get(slug);
  if (cached && Date.now() - cached.ts < 60_000) return cached.data;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_public_tenant_by_slug", { p_slug: slug });
  if (error) return null;
  if (!data || (Array.isArray(data) && data.length === 0)) {
    tenantBySlugCache.set(slug, { data: null, ts: Date.now() });
    return null;
  }
  const tenant = (Array.isArray(data) ? data[0] : data) as PublicTenant;
  tenantBySlugCache.set(slug, { data: tenant, ts: Date.now() });
  return tenant;
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
 * Resolve um tenant pelo slug SEM exigir que o site esteja público.
 * Usado exclusivamente pela rota pública /[slug] quando o visitante chega
 * por um link de afiliado (`?ref=`) e o slug NÃO casa com um site público
 * ativo. Sem este helper, a rota cai em notFound() e perde a atribuição.
 *
 * A RPC `get_tenant_for_affiliate_lookup` retorna o tenant mesmo se
 * site_status != 'active' ou se a assinatura não estiver ativa.
 */
export async function getAffiliateLookupTenantBySlug(slug: string): Promise<PublicTenant | null> {
  if (!hasSupabaseEnv()) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_tenant_for_affiliate_lookup", { p_slug: slug });
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
      false,
      tenant.monthly_billing_enabled !== false
    )
      ? ("available" as const)
      : ("suspended" as const),
    subscription: (sub as Subscription) || null,
  };
}
