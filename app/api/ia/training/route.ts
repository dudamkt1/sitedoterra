import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { normalizeSectionPermissions } from "@/lib/site-sections";
import type { IaTrainingEntry } from "@/lib/ia-knowledge";

export const runtime = "nodejs";

function cleanEntry(raw: unknown): IaTrainingEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const keywords = typeof e.keywords === "string" ? e.keywords.trim() : "";
  const text = typeof e.text === "string" ? e.text.trim() : "";
  const oils = Array.isArray(e.oils)
    ? e.oils.map((o) => String(o).trim()).filter((o) => o)
    : [];
  if (!keywords && !text) return null;
  return { keywords, text, oils };
}

function normalizeSectionPermissionsLike(raw: unknown) {
  return normalizeSectionPermissions(raw as Record<string, unknown> | null | undefined);
}

/**
 * GET /api/ia/training
 * Retorna o treinamento (perguntas e respostas pré-prontas) da seção
 * "Especialista IA doTERRA" para o tenant do usuário logado.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const { data: aboutSection } = await admin
    .from("site_sections")
    .select("*")
    .eq("type", "about")
    .maybeSingle();

  if (!aboutSection) {
    return NextResponse.json({ knowledge: [], sectionId: null, can_edit: true });
  }

  const { data: override } = await admin
    .from("tenant_sections")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("section_id", (aboutSection as { id: string }).id)
    .maybeSingle();

  const globalKnowledge = ((aboutSection.content as Record<string, unknown>)?.knowledge as IaTrainingEntry[]) || [];
  const tenantKnowledge = ((override?.content as Record<string, unknown>)?.knowledge as IaTrainingEntry[]) || [];
  const knowledge = tenantKnowledge.length > 0 ? tenantKnowledge : globalKnowledge;

  const perms = normalizeSectionPermissionsLike((aboutSection as { permissions: unknown }).permissions);

  return NextResponse.json({
    knowledge,
    sectionId: (aboutSection as { id: string }).id,
    can_edit: perms.can_edit !== false,
  });
}

/**
 * POST /api/ia/training
 * { knowledge: IaTrainingEntry[] }
 * Salva o treinamento do consultor (sobreposição local no tenant_sections,
 * preservando os demais campos de conteúdo da seção about).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const rawEntries: unknown[] = Array.isArray(body.knowledge) ? body.knowledge : [];
  const knowledge = rawEntries.map(cleanEntry).filter((e): e is IaTrainingEntry => Boolean(e));

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const { data: aboutSection } = await admin
    .from("site_sections")
    .select("*")
    .eq("type", "about")
    .maybeSingle();

  if (!aboutSection) {
    return NextResponse.json({ error: "Seção Especialista IA não encontrada" }, { status: 404 });
  }

  const sectionId = (aboutSection as { id: string }).id;
  const perms = normalizeSectionPermissionsLike((aboutSection as { permissions: unknown }).permissions);
  if (perms.can_edit === false) {
    return NextResponse.json({ error: "Você não tem permissão para treinar esta seção." }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("tenant_sections")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("section_id", sectionId)
    .maybeSingle();

  const existingContent = ((existing?.content as Record<string, unknown>) || {});
  const content = { ...existingContent, knowledge };

  const { error } = await admin.from("tenant_sections").upsert(
    {
      tenant_id: tenant.id,
      section_id: sectionId,
      enabled: existing?.enabled !== false,
      content,
      settings: (existing?.settings as Record<string, unknown>) || {},
    },
    { onConflict: "tenant_id,section_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Erro ao salvar o treinamento." }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "user",
    action: "tenant_section.ia_training_updated",
    entity_type: "tenant_section",
    entity_id: sectionId,
    metadata: { tenant_id: tenant.id, count: knowledge.length },
  });

  return NextResponse.json({ success: true, knowledge });
}