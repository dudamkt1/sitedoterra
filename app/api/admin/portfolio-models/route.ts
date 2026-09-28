import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { SECTION_TYPES } from "@/lib/site-sections";
import { normalizeParagraphs, sanitizeProductsContent } from "@/lib/section-fields";
import { invalidatePortfolioModelsCache, type PortfolioModelSection } from "@/lib/portfolio";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

async function requireSuperAdmin(): Promise<NextResponse | null> {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return null;
}

const KNOWN_TYPES = new Set<string>(SECTION_TYPES);

function cleanContent(content: unknown, type?: string): Record<string, unknown> {
  const out =
    content && typeof content === "object" && !Array.isArray(content)
      ? { ...(content as Record<string, unknown>) }
      : {};
  if (type === "story" && "paragraphs" in out) out.paragraphs = normalizeParagraphs(out.paragraphs);
  if (type === "products") return sanitizeProductsContent(out);
  return out;
}

function cleanPermissions(p: unknown): Record<string, unknown> {
  const base = p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
  const keys = [
    "can_edit", "can_toggle", "can_edit_image", "can_edit_video",
    "can_edit_button", "can_edit_colors", "can_edit_layout", "available_to_all",
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = base[k] !== undefined ? Boolean(base[k]) : true;
  return out;
}

/**
 * Normaliza a estrutura de seções de um modelo (o jsonb que vira cópia do
 * site do usuário). Só aceita tipos conhecidos — impede que um JSON sujo
 * gere uma seção que o renderizador não sabe montar.
 */
function cleanSections(raw: unknown): PortfolioModelSection[] {
  if (!Array.isArray(raw)) return [];
  const out: PortfolioModelSection[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i] as Record<string, unknown> | null;
    if (!s || typeof s !== "object") continue;
    const key = typeof s.key === "string" && s.key ? s.key : "";
    const type = typeof s.type === "string" ? s.type : "";
    if (!key || !KNOWN_TYPES.has(type)) continue;
    out.push({
      key,
      type: type as PortfolioModelSection["type"],
      label: typeof s.label === "string" && s.label ? s.label : type,
      title: typeof s.title === "string" ? s.title : null,
      subtitle: typeof s.subtitle === "string" ? s.subtitle : null,
      enabled: s.enabled !== false,
      is_required: s.is_required === true,
      sort_order: Number.isFinite(Number(s.sort_order)) ? Number(s.sort_order) : (i + 1) * 10,
      settings:
        s.settings && typeof s.settings === "object" && !Array.isArray(s.settings)
          ? (s.settings as Record<string, unknown>)
          : {},
      content: cleanContent(s.content, type),
      permissions: cleanPermissions(s.permissions),
    });
  }
  return out.sort((a, b) => a.sort_order - b.sort_order);
}

function cleanMeta(body: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (body.key !== undefined) payload.key = slugify(String(body.key || ""));
  if (body.name !== undefined) payload.name = String(body.name || "").slice(0, 120);
  if (body.company !== undefined) payload.company = body.company ? String(body.company).slice(0, 120) : null;
  if (body.category !== undefined) payload.category = body.category ? String(body.category).slice(0, 120) : null;
  if (body.description !== undefined) payload.description = body.description ? String(body.description) : null;
  if (body.thumbnail_url !== undefined) payload.thumbnail_url = body.thumbnail_url ? String(body.thumbnail_url) : null;
  if (body.cover_url !== undefined) payload.cover_url = body.cover_url ? String(body.cover_url) : null;
  if (body.demo_url !== undefined) payload.demo_url = body.demo_url ? String(body.demo_url) : null;
  if (body.status !== undefined) payload.status = body.status === "draft" ? "draft" : "active";
  if (body.is_selectable !== undefined) payload.is_selectable = Boolean(body.is_selectable);
  if (body.sort_order !== undefined) payload.sort_order = Number(body.sort_order) || 0;
  if (body.site_data !== undefined && body.site_data && typeof body.site_data === "object") {
    payload.site_data = body.site_data;
  }
  if (body.sections !== undefined) payload.sections = cleanSections(body.sections);
  return payload;
}

/**
 * Pós-mutação: derruba o cache de modelos e revalida as páginas que os
 * exibem (Home da plataforma e /portfolio). Sites já criados não são
 * afetados — o modelo virou cópia independente na ativação deles.
 */
function afterMutation(paths: string[] = ["/", "/portfolio"]) {
  invalidatePortfolioModelsCache();
  try {
    for (const p of paths) revalidatePath(p);
  } catch {
    // revalidatePath é best-effort.
  }
}

/** Estrutura de seções a partir do template global (quando não há origem). */
async function sectionsFromGlobalTemplate(admin: ReturnType<typeof createAdminClient>) {
  const { data: globals } = await admin
    .from("site_sections")
    .select("*")
    .order("sort_order", { ascending: true });
  return cleanSections(
    ((globals as Record<string, unknown>[] | null) || []).map((g) => ({
      key: g.key,
      type: g.type,
      label: g.label,
      title: g.title,
      subtitle: g.subtitle,
      enabled: g.enabled,
      is_required: g.is_required,
      sort_order: g.sort_order,
      settings: g.settings,
      content: g.content,
      permissions: g.permissions,
    }))
  );
}

export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portfolio_models")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Erro ao carregar modelos" }, { status: 500 });
  return NextResponse.json({ models: data || [] });
}

export async function POST(request: Request) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const admin = createAdminClient();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  // ---------- CRIAR ----------
  if (action === "create") {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Informe o nome do modelo." }, { status: 400 });
    const baseKey = slugify(String(body.key || name)) || `modelo-${Date.now()}`;
    const { data: existing } = await admin
      .from("portfolio_models")
      .select("key")
      .eq("key", baseKey)
      .maybeSingle();
    const key = existing ? `${baseKey}-${Date.now().toString().slice(-4)}` : baseKey;

    // Estrutura inicial: cópia do modelo de origem (ou template global).
    let sections: PortfolioModelSection[] = [];
    const copyFrom = typeof body.copyFrom === "string" && body.copyFrom ? body.copyFrom : "";
    if (copyFrom) {
      const { data: src } = await admin
        .from("portfolio_models")
        .select("sections")
        .eq("key", copyFrom)
        .maybeSingle();
      if (src) sections = cleanSections((src as { sections?: unknown }).sections);
    }
    if (sections.length === 0) sections = await sectionsFromGlobalTemplate(admin);

    const { data, error } = await admin
      .from("portfolio_models")
      .insert({
        key,
        name,
        company: body.company ? String(body.company) : null,
        category: body.category ? String(body.category) : null,
        description: body.description ? String(body.description) : null,
        thumbnail_url: body.thumbnail_url ? String(body.thumbnail_url) : null,
        cover_url: body.cover_url ? String(body.cover_url) : null,
        demo_url: body.demo_url ? String(body.demo_url) : null,
        status: body.status === "draft" ? "draft" : "active",
        is_default: false,
        is_selectable: body.is_selectable === false ? false : true,
        sort_order: Number(body.sort_order) || 0,
        sections,
        site_data: {},
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: "Erro ao criar modelo" }, { status: 500 });
    }
    afterMutation();
    return NextResponse.json({ success: true, model: data });
  }

  // ---------- ATUALIZAR ----------
  if (action === "update") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Modelo não informado" }, { status: 400 });
    const payload = cleanMeta(body);
    if (payload.key !== undefined) {
      const { data: clash } = await admin
        .from("portfolio_models")
        .select("id")
        .eq("key", String(payload.key))
        .neq("id", id)
        .maybeSingle();
      if (clash) return NextResponse.json({ error: "Já existe um modelo com essa chave." }, { status: 400 });
    }
    const { error } = await admin.from("portfolio_models").update(payload).eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao atualizar modelo" }, { status: 500 });
    afterMutation();
    return NextResponse.json({ success: true });
  }

  // ---------- DEFINIR COMO PADRÃO ----------
  if (action === "set-default") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Modelo não informado" }, { status: 400 });
    // Índice único parcial garante UM padrão: limpa antes de marcar.
    const { error: clearErr } = await admin
      .from("portfolio_models")
      .update({ is_default: false })
      .neq("id", id);
    if (clearErr) return NextResponse.json({ error: "Erro ao definir padrão" }, { status: 500 });
    const { error } = await admin.from("portfolio_models").update({ is_default: true }).eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao definir padrão" }, { status: 500 });
    afterMutation();
    return NextResponse.json({ success: true });
  }

  // ---------- DUPLICAR ----------
  if (action === "duplicate") {
    const id = String(body.id || "");
    const { data: src } = await admin.from("portfolio_models").select("*").eq("id", id).maybeSingle();
    if (!src) return NextResponse.json({ error: "Modelo não encontrado" }, { status: 404 });
    const srcRow = src as Record<string, unknown>;
    const baseKey = `${slugify(String(srcRow.key))}-copia`;
    const { data: existing } = await admin.from("portfolio_models").select("key").eq("key", baseKey).maybeSingle();
    const key = existing ? `${baseKey}-${Date.now().toString().slice(-4)}` : baseKey;
    const { data: maxRow } = await admin
      .from("portfolio_models")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextOrder = ((maxRow && (maxRow[0]?.sort_order as number)) || 0) + 10;
    const { data: dup, error } = await admin
      .from("portfolio_models")
      .insert({
        key,
        name: `${srcRow.name} (cópia)`,
        company: srcRow.company || null,
        category: srcRow.category || null,
        description: srcRow.description || null,
        thumbnail_url: srcRow.thumbnail_url || null,
        cover_url: srcRow.cover_url || null,
        demo_url: null,
        status: "draft",
        is_default: false,
        is_selectable: false,
        sort_order: nextOrder,
        sections: srcRow.sections || [],
        site_data: srcRow.site_data || {},
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: "Erro ao duplicar modelo" }, { status: 500 });
    afterMutation();
    return NextResponse.json({ success: true, model: dup });
  }

  // ---------- EXCLUIR ----------
  if (action === "delete") {
    const id = String(body.id || "");
    const { data: row } = await admin
      .from("portfolio_models")
      .select("is_default, name")
      .eq("id", id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Modelo não encontrado" }, { status: 404 });
    if ((row as { is_default?: boolean }).is_default) {
      return NextResponse.json(
        { error: "O Modelo Padrão não pode ser excluído — defina outro como padrão antes." },
        { status: 400 }
      );
    }
    const { error } = await admin.from("portfolio_models").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao excluir modelo" }, { status: 500 });
    afterMutation();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
