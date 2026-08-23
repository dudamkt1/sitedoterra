import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { resolveHomeSections } from "@/lib/home";
import { normalizeSectionPermissions } from "@/lib/site-sections";
import type { SectionPermissions, SiteSection, TenantSection } from "@/types";

export const runtime = "nodejs";

const IMAGE_KEYS = ["image", "gradient"];
const VIDEO_KEYS = ["videoUrl"];
const BUTTON_KEYS = ["primaryBtn", "secondaryBtn", "buttonText", "buttonUrl", "storeUrl", "btnText", "btnUrl"];

function filterContentByPermissions(content: Record<string, unknown>, perms: SectionPermissions): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (perms.can_edit_image === false && IMAGE_KEYS.includes(key)) continue;
    if (perms.can_edit_video === false && VIDEO_KEYS.includes(key)) continue;
    if (perms.can_edit_button === false && BUTTON_KEYS.includes(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = filterContentByPermissions(value as Record<string, unknown>, perms);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Chaves internas (prefixo "_") são calculadas na renderização — nunca salvar. */
function stripInternalKeys(content: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (key.startsWith("_")) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = stripInternalKeys(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * GET /api/sections
 * Retorna as seções da HOME para o painel do usuário logado, com as
 * permissões que o Super Admin definiu para cada uma e o estado atual do
 * site do usuário (ativado/desativado e conteúdo personalizado).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const profile = await getProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const { data: settingsRow } = await admin
    .from("site_settings")
    .select("data")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  const siteData = (settingsRow?.data as Record<string, unknown>) || {};

  const sections = await resolveHomeSections({
    tenant: { tenant_id: tenant.id, slug: tenant.slug, site_data: siteData } as never,
    tenantDataOverridesGlobal: true,
  });

  const { data: tenantRows } = await admin
    .from("tenant_sections")
    .select("*")
    .eq("tenant_id", tenant.id);
  const tenantMap = new Map<string, TenantSection>();
  for (const row of (tenantRows as unknown as TenantSection[]) || []) tenantMap.set(row.section_id, row);

  const result = sections.map((s) => {
    const perms = normalizeSectionPermissions(s.permissions);
    const override = tenantMap.get(s.id);
    const canToggle = perms.can_toggle !== false && !s.is_required;
    const canEdit = perms.can_edit !== false;
    return {
      id: s.id,
      key: s.key,
      type: s.type,
      label: s.label,
      anchor: s.anchor,
      navLabel: s.navLabel,
      is_required: s.is_required,
      global_enabled: s.enabled,
      enabled: s.enabled,
      effective_enabled: s.enabled,
      has_override: !!override,
      tenant_content: override?.content || {},
      content: s.content,
      permissions: perms,
      can_toggle: canToggle,
      can_edit: canEdit,
      global_default: true,
    };
  });

  return NextResponse.json({
    sections: result,
    tenant: { id: tenant.id, slug: tenant.slug, site_status: tenant.site_status },
    isSuperAdmin: profile.role === "superadmin",
  });
}

/**
 * POST /api/sections
 * { action: "toggle", sectionId, enabled } → ativa/desativa a seção no site do usuário
 * { action: "save", sectionId, content }   → salva o conteúdo personalizado
 * Respeita as permissões definidas pelo Super Admin (validação no servidor).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const action = String(body.action || "save");
  const sectionId = String(body.sectionId || "");

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const { data: section } = await admin
    .from("site_sections")
    .select("*")
    .eq("id", sectionId)
    .maybeSingle();
  if (!section) return NextResponse.json({ error: "Seção não encontrada" }, { status: 404 });

  const perms = normalizeSectionPermissions((section as SiteSection).permissions);

  const { data: existing } = await admin
    .from("tenant_sections")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("section_id", sectionId)
    .maybeSingle();
  const existingRow = existing as unknown as TenantSection | null;

  let enabled = existingRow?.enabled !== false;
  let content = existingRow?.content || {};
  let settings = existingRow?.settings || {};

  if (action === "toggle") {
    if (!perms.can_toggle) {
      return NextResponse.json({ error: "Você não tem permissão para ativar/desativar esta seção." }, { status: 403 });
    }
    if ((section as SiteSection).is_required) {
      return NextResponse.json({ error: "Esta seção é obrigatória e não pode ser desativada." }, { status: 403 });
    }
    enabled = Boolean(body.enabled);
  } else if (action === "save") {
    if (perms.can_edit === false) {
      return NextResponse.json({ error: "Você não tem permissão para editar esta seção." }, { status: 403 });
    }
    const incoming = (body.content && typeof body.content === "object" ? body.content : {}) as Record<string, unknown>;
    const filtered = stripInternalKeys(filterContentByPermissions(incoming, perms));
    content = filtered;
    if (body.settings && typeof body.settings === "object") {
      if (perms.can_edit_colors) settings = { ...settings, ...(body.settings as Record<string, unknown>) };
    }
  } else {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const { error } = await admin
    .from("tenant_sections")
    .upsert(
      { tenant_id: tenant.id, section_id: sectionId, enabled, content, settings },
      { onConflict: "tenant_id,section_id" }
    );

  if (error) return NextResponse.json({ error: "Erro ao salvar a seção." }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "user",
    action: action === "toggle" ? "tenant_section.toggled" : "tenant_section.content_updated",
    entity_type: "tenant_section",
    entity_id: sectionId,
    metadata: { tenant_id: tenant.id, action, enabled },
  });

  return NextResponse.json({ success: true });
}
