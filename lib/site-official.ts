import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicTenantBySlug } from "@/lib/tenant";
import { DEFAULT_SITE_DATA } from "@/lib/site-data";
import type { PublicTenant } from "@/types";

/**
 * Fonte única de verdade para o "site oficial" da plataforma.
 *
 * O site oficial é o tenant que aparece em:
 *   - Home `/`
 *   - `/demonstracao` (como seed inicial que o visitante pode personalizar localmente)
 *   - Sites pertencentes ao super admin quando a flag está habilitada
 *
 * A resolução segue a ordem:
 *   1) `tenants.is_official_home = true` (preferido, configurável pelo super admin)
 *   2) `platform_config.home_tenant_slug` (slug configurado)
 *   3) Tenant de qualquer usuário com role='superadmin' (fallback)
 *   4) Fallback estático (DEMO_TENANT) — preserva renderização quando Supabase falha
 */

const OFFICIAL_HOME_CACHE_MS = 30_000;
let officialHomeCache: { data: PublicTenant | null; ts: number } | null = null;

function fallbackTenant(): PublicTenant {
  return {
    tenant_id: "index",
    slug: "index",
    site_name: "TopConsultores",
    site_status: "active",
    settings: {},
    site_data: DEFAULT_SITE_DATA as Record<string, unknown>,
    profile_name: "TopConsultores",
    email: "",
    monthly_billing_enabled: true,
    user_id: "demo-user-id",
  };
}

/**
 * Retorna o tenant oficial da plataforma, ou fallback se não encontrado.
 */
export async function getOfficialHomeTenant(): Promise<PublicTenant> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fallbackTenant();
  }

  if (officialHomeCache && Date.now() - officialHomeCache.ts < OFFICIAL_HOME_CACHE_MS) {
    return officialHomeCache.data || fallbackTenant();
  }

  const admin = createAdminClient();

  try {
    const { data: tenant } = await admin.rpc("resolve_official_home_tenant" as never);
    if (tenant && (tenant as { id?: string }).id) {
      const t = tenant as unknown as PublicTenant;
      officialHomeCache = { data: t, ts: Date.now() };
      return t;
    }
  } catch {
    // função pode não existir se a migration 0041 ainda não foi aplicada.
  }

  // Fallback: lê slug configurado e tenta resolver pelo slug.
  try {
    const { data: cfg } = await admin
      .from("platform_config")
      .select("value")
      .eq("key", "home_tenant_slug")
      .maybeSingle();
    const slug = cfg?.value ? String((cfg.value as string | { slug?: string }) as string) : null;
    if (slug) {
      const t = await getPublicTenantBySlug(slug);
      if (t) {
        officialHomeCache = { data: t, ts: Date.now() };
        return t;
      }
    }
  } catch {
    // ignora
  }

  officialHomeCache = { data: null, ts: Date.now() };
  return fallbackTenant();
}

/**
 * Limpa o cache em memória (útil em testes e após mutações).
 */
export function invalidateOfficialHomeCache(): void {
  officialHomeCache = null;
}

/**
 * Identifica se um tenant qualquer é o "oficial".
 * Usado por `app/(site)/[slug]/page.tsx` para sincronizar sites do super admin
 * com a Home oficial quando habilitado.
 */
export async function isOfficialHomeTenantById(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return false;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }
  const admin = createAdminClient();
  try {
    const { data, error } = await admin.rpc("is_official_home_tenant" as never, { p_tenant_id: tenantId } as never);
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}