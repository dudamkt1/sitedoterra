import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { invalidateOfficialHomeCache } from "@/lib/site-official";
import { invalidateTenantSlugCache } from "@/lib/tenant";
import { invalidateGlobalSectionsCache } from "@/lib/home";
import { blockIfDemo } from "@/lib/demo/auth";
import type { SiteThemeConfig } from "@/lib/site-theme";

export const runtime = "nodejs";

/**
 * Campos de "Informações do site" → chaves de conteúdo das seções que eles
 * alimentam (via `legacyContentFor` em lib/home.ts).
 *
 * Por que podar: `resolveHomeSections` prioriza `tenant_sections` (editor
 * "Minha Home") sobre `site_settings` ("Informações"). Se o usuário um dia
 * salvou a seção no editor, o snapshot congelado passa a vencer — e as
 * edições de "Informações" param de refletir no site. Ao salvar aqui,
 * removemos SÓ essas chaves dos overrides existentes: "Informações" volta a
 * comandar (last-write-wins por campo) sem apagar o resto da personalização
 * (imagens, botões, ativa/desativa).
 */
const INFORMACOES_PRUNE_MAP: Record<string, { type: string; keys: string[] }[]> = {
  name: [{ type: "hero", keys: ["firstName"] }],
  surname: [{ type: "hero", keys: ["lastName"] }],
  role: [{ type: "hero", keys: ["role"] }],
  eyebrow: [{ type: "hero", keys: ["eyebrow"] }],
  description: [{ type: "hero", keys: ["description"] }],
  badgeTitle: [{ type: "hero", keys: ["badgeTitle"] }],
  badgeSubtitle: [{ type: "hero", keys: ["badgeSubtitle"] }],
  stats: [{ type: "hero", keys: ["stats"] }],
  whatsapp: [
    { type: "footer", keys: ["_contactWhatsapp"] },
    { type: "products", keys: ["_contactWhatsapp"] },
    { type: "hero2contact", keys: ["_contactWhatsapp"] },
  ],
  email: [
    { type: "footer", keys: ["_contactEmail"] },
    { type: "hero2contact", keys: ["_contactEmail"] },
  ],
  instagram: [{ type: "footer", keys: ["_contactInstagram"] }],
  instagramHandle: [
    { type: "footer", keys: ["_contactInstagram"] },
    { type: "tips", keys: ["instagramHandle", "instagramUrl"] },
  ],
  fullName: [{ type: "footer", keys: ["_profileName"] }],
  social: [{ type: "footer", keys: ["social"] }],
};

async function pruneFrozenOverrides(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  saved: Record<string, unknown>
): Promise<void> {
  try {
    const targets: { type: string; keys: string[] }[] = [];
    for (const field of Object.keys(saved)) {
      const mapped = INFORMACOES_PRUNE_MAP[field];
      if (mapped) targets.push(...mapped);
    }
    if (targets.length === 0) return;

    const [{ data: allSections }, { data: overrides }] = await Promise.all([
      admin.from("site_sections").select("id, type"),
      admin.from("tenant_sections").select("id, section_id, content").eq("tenant_id", tenantId),
    ]);
    if (!overrides || overrides.length === 0) return;

    const typeById: Record<string, string> = {};
    for (const s of (allSections as { id: string; type: string }[] | null) || []) {
      typeById[s.id] = s.type;
    }

    for (const row of (overrides as { id: string; section_id: string; content: unknown }[])) {
      const type = typeById[row.section_id];
      if (!type) continue;
      const keys = targets.filter((t) => t.type === type).flatMap((t) => t.keys);
      if (keys.length === 0) continue;
      const content = (row.content || {}) as Record<string, unknown>;
      let changed = false;
      for (const k of keys) {
        if (k in content) {
          delete content[k];
          changed = true;
        }
      }
      if (changed) {
        await admin.from("tenant_sections").update({ content }).eq("id", row.id);
      }
    }
  } catch (e) {
    // Best-effort: nunca bloqueia o salvamento das Informações.
    console.warn("[api/site] prune de overrides falhou", e);
  }
}

/** Valida o tema salvo em site_settings.data.theme. */
function sanitizeTheme(raw: unknown): SiteThemeConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Record<string, unknown>;
  const preset = ["verde", "roxo", "eucalipto"].includes(String(t.preset))
    ? (String(t.preset) as SiteThemeConfig["preset"])
    : "verde";
  const primaryRaw = typeof t.primary === "string" ? t.primary.trim() : "";
  const primary = /^#([0-9a-f]{6})$/i.test(primaryRaw) ? primaryRaw.toLowerCase() : null;
  return { preset, primary };
}

/**
 * Salva o conteúdo/configurações do site do tenant (site_settings.data).
 */
export async function POST(request: Request) {
  // BLINDAGEM DEMO: visitante em /demonstracao nunca grava no banco oficial.
  const demoBlock = await blockIfDemo();
  if (demoBlock) return demoBlock.response;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const allowed = [
    "name", "surname", "fullName", "role", "eyebrow", "description",
    "badgeTitle", "badgeSubtitle",
    "whatsapp", "email", "instagram", "instagramHandle",
    "whatsapp_floating_enabled",
    "logoMode", "logoUrl", "logoLightUrl", "logoText",
    "faviconUrl",
    "stats", "testimonials", "history", "products", "faq", "schedule",
    "video", "social", "site_title",
  ];

  // Sanitiza: mantǸm apenas chaves permitidas
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }
  const theme = sanitizeTheme(body.theme);
  if (theme) data.theme = theme;

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const { data: existing } = await admin
    .from("site_settings")
    .select("data")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const merged = { ...(existing?.data as Record<string, unknown>), ...data };

  const { error } = await admin
    .from("site_settings")
    .upsert({ tenant_id: tenant.id, data: merged }, { onConflict: "tenant_id" });

  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar as configurações." }, { status: 500 });
  }

  // Descongela: campos salvos aqui voltam a vencer snapshots antigos do
  // editor "Minha Home" (last-write-wins por campo).
  await pruneFrozenOverrides(admin, tenant.id, data);

  // Invalida caches para que mudanças reflitam imediatamente na Home `/`,
  // na rota `/[slug]` e em `/demonstracao` (que usa o site oficial como seed).
  invalidateOfficialHomeCache();
  invalidateGlobalSectionsCache();
  invalidateTenantSlugCache(tenant.slug);
  try {
    revalidatePath("/");
    if (tenant.slug) revalidatePath(`/${tenant.slug}`);
  } catch {
    // revalidatePath é best-effort; não bloqueia resposta.
  }

  return NextResponse.json({ success: true });
}
