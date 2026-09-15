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

/**
 * Campos APRESENTÁVEIS herdados do domínio principal (conteúdo, nunca
 * contato): o site novo espelha a HOME oficial até o usuário personalizar.
 * FORA DAQUI (nunca copiados — senão leads/contatos iriam para o admin):
 * whatsapp, whatsapp_floating_enabled, email, instagram, instagramHandle,
 * social, logo*, faviconUrl, theme, site_title.
 */
const OFFICIAL_SEED_KEYS = [
  "name",
  "surname",
  "fullName",
  "role",
  "eyebrow",
  "description",
  "badgeTitle",
  "badgeSubtitle",
  "stats",
  "testimonials",
  "history",
  "products",
  "faq",
  "schedule",
  "video",
] as const;

async function ensureSiteSettings(tenantId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("site_settings")
    .select("tenant_id, data")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) {
    await admin.from("site_settings").insert({ tenant_id: tenantId, data: {} });
  }
  // Seed: site novo começa espelhando o conteúdo do domínio principal.
  // Só quando ainda está vazio — nunca sobrescreve o que o usuário já tem.
  try {
    const current = ((data as { data?: Record<string, unknown> } | null)?.data || {}) as Record<
      string,
      unknown
    >;
    if (Object.keys(current).length > 0) return;
    const { getOfficialHomeTenant } = await import("@/lib/site-official");
    const official = await getOfficialHomeTenant();
    // Fallback estático (sem tenant oficial configurado): não há o que
    // espelhar — o site já cai nos defaults do template sozinho.
    if (!official || official.tenant_id === "index") return;
    const source = (official?.site_data || {}) as Record<string, unknown>;
    const seed: Record<string, unknown> = {};
    for (const key of OFFICIAL_SEED_KEYS) {
      const value = source[key];
      if (value !== undefined && value !== null) seed[key] = value;
    }
    if (Object.keys(seed).length === 0) return;
    const merged = { ...current, ...seed };
    if (data) {
      await admin.from("site_settings").update({ data: merged }).eq("tenant_id", tenantId);
    } else {
      await admin.from("site_settings").insert({ tenant_id: tenantId, data: merged });
    }
  } catch {
    // Best-effort: onboarding nunca quebra por causa do seed.
  }
}
