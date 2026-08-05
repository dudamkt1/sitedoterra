import { createAdminClient } from "@/lib/supabase/admin";
import type { Tenant } from "@/types";

/**
 * Garante que o usuário possua um tenant (e site_settings) no banco.
 * Cria com slug temporário e status 'pending' quando necessário.
 * Idempotente — seguro chamar a cada visita ao painel.
 */
export async function ensureTenantForUser(userId: string): Promise<Tenant | null> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("tenants")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await ensureSiteSettings(existing.id);
    return existing as Tenant;
  }

  // Slug temporário único: aguardando-<prefixo do user_id>
  const prefix = userId.replace(/-/g, "").slice(0, 10);
  let slug = `aguardando-${prefix}`;
  const { data: check } = await admin.from("tenants").select("slug").eq("slug", slug).maybeSingle();
  if (check) {
    slug = `aguardando-${prefix}-${Date.now().toString(36)}`;
  }

  const { data: tenant, error } = await admin
    .from("tenants")
    .insert({
      user_id: userId,
      slug,
      site_name: null,
      site_status: "pending",
      settings: {},
    })
    .select("*")
    .single();

  if (error || !tenant) {
    // Corrida: outro processo pode ter criado — tenta buscar de novo
    const { data: retry } = await admin
      .from("tenants")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (retry) {
      await ensureSiteSettings(retry.id);
      return retry as Tenant;
    }
    return null;
  }

  await ensureSiteSettings(tenant.id);
  return tenant as Tenant;
}

async function ensureSiteSettings(tenantId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("site_settings")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) {
    await admin.from("site_settings").insert({ tenant_id: tenantId, data: {} });
  }
}
