import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { SECTION_TYPES, SECTION_TYPE_LABELS, DEFAULT_SECTION_CONTENT } from "@/lib/site-sections";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

async function requireSuperAdmin(): Promise<NextResponse | null> {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return null;
}

function cleanContent(content: unknown): Record<string, unknown> {
  return content && typeof content === "object" && !Array.isArray(content) ? (content as Record<string, unknown>) : {};
}

function cleanPermissions(p: unknown): Record<string, unknown> {
  const base = p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
  const keys = ["can_edit", "can_toggle", "can_edit_image", "can_edit_video", "can_edit_button", "can_edit_colors", "can_edit_layout", "available_to_all"];
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = base[k] !== undefined ? Boolean(base[k]) : true;
  return out;
}

export async function POST(request: Request) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const admin = createAdminClient();
  const body = await request.json();
  const action = String(body.action || "update");

  // ---------- CRIAR ----------
  if (action === "create") {
    const type = String(body.type || "");
    if (!SECTION_TYPES.includes(type as (typeof SECTION_TYPES)[number])) {
      return NextResponse.json({ error: "Tipo de seção inválido" }, { status: 400 });
    }
    const label = String(body.label || SECTION_TYPE_LABELS[type as (typeof SECTION_TYPES)[number] || type] || "Nova seção");
    const baseKey = String(body.key || slugify(label) || `section-${Date.now()}`);
    const { data: existing } = await admin
      .from("site_sections")
      .select("key")
      .eq("key", baseKey)
      .maybeSingle();
    const key = existing ? `${baseKey}-${Date.now().toString().slice(-4)}` : baseKey;

    const { data: maxRow } = await admin
      .from("site_sections")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextOrder = (maxRow && (maxRow[0]?.sort_order as number) || 0) + 10;

    const { data, error } = await admin
      .from("site_sections")
      .insert({
        type,
        key,
        label,
        title: body.title || null,
        subtitle: body.subtitle || null,
        enabled: true,
        is_required: Boolean(body.is_required),
        sort_order: nextOrder,
        settings: body.settings && typeof body.settings === "object" ? body.settings : {},
        content: cleanContent(body.content && Object.keys(body.content).length ? body.content : DEFAULT_SECTION_CONTENT[type as keyof typeof DEFAULT_SECTION_CONTENT]),
        permissions: cleanPermissions(body.permissions),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Erro ao criar seção" }, { status: 500 });
    return NextResponse.json({ success: true, section: data });
  }

  // ---------- ATUALIZAR ----------
  if (action === "update") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Seção não informada" }, { status: 400 });
    const payload: Record<string, unknown> = {};
    if (body.label !== undefined) payload.label = String(body.label);
    if (body.title !== undefined) payload.title = body.title || null;
    if (body.subtitle !== undefined) payload.subtitle = body.subtitle || null;
    if (body.enabled !== undefined) payload.enabled = Boolean(body.enabled);
    if (body.is_required !== undefined) payload.is_required = Boolean(body.is_required);
    if (body.sort_order !== undefined) payload.sort_order = Number(body.sort_order) || 0;
    if (body.settings !== undefined) payload.settings = body.settings || {};
    if (body.content !== undefined) payload.content = cleanContent(body.content);
    if (body.permissions !== undefined) payload.permissions = cleanPermissions(body.permissions);

    const { error } = await admin.from("site_sections").update(payload).eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao atualizar seção" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ---------- EXCLUIR ----------
  if (action === "delete") {
    const id = String(body.id || "");
    const { data: sec } = await admin.from("site_sections").select("is_required").eq("id", id).maybeSingle();
    if (sec?.is_required) {
      return NextResponse.json({ error: "Seções obrigatórias não podem ser excluídas." }, { status: 400 });
    }
    const { error } = await admin.from("site_sections").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao excluir seção" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ---------- DUPLICAR ----------
  if (action === "duplicate") {
    const id = String(body.id || "");
    const { data: src, error: getErr } = await admin.from("site_sections").select("*").eq("id", id).maybeSingle();
    if (getErr || !src) return NextResponse.json({ error: "Seção não encontrada" }, { status: 404 });
    const { data: maxRow } = await admin.from("site_sections").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const nextOrder = (maxRow && (maxRow[0]?.sort_order as number) || 0) + 10;
    const baseKey = `${src.key}-copia`;
    const { data: existing } = await admin.from("site_sections").select("key").eq("key", baseKey).maybeSingle();
    const key = existing ? `${src.key}-copia-${Date.now().toString().slice(-4)}` : baseKey;
    const { data: dup, error } = await admin
      .from("site_sections")
      .insert({
        type: src.type,
        key,
        label: `${src.label} (cópia)`,
        title: src.title,
        subtitle: src.subtitle,
        enabled: false,
        is_required: false,
        sort_order: nextOrder,
        settings: src.settings,
        content: src.content,
        permissions: src.permissions,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: "Erro ao duplicar seção" }, { status: 500 });
    return NextResponse.json({ success: true, section: dup });
  }

  // ---------- REORDENAR ----------
  if (action === "reorder") {
    const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
    for (let i = 0; i < ids.length; i++) {
      await admin
        .from("site_sections")
        .update({ sort_order: (i + 1) * 10 })
        .eq("id", ids[i]);
    }
    return NextResponse.json({ success: true });
  }

  // ---------- ALTERNAR ATIVO ----------
  if (action === "toggle") {
    const id = String(body.id || "");
    const enabled = Boolean(body.enabled);
    const { data: sec } = await admin.from("site_sections").select("is_required").eq("id", id).maybeSingle();
    if (sec?.is_required && !enabled) {
      return NextResponse.json({ error: "Seções obrigatórias não podem ser desativadas." }, { status: 400 });
    }
    const { error } = await admin.from("site_sections").update({ enabled }).eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao atualizar seção" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}

/** GET: lista todas as seções globais (Super Admin). */
export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const admin = createAdminClient();
  const { data, error } = await admin.from("site_sections").select("*").order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: "Erro ao carregar seções" }, { status: 500 });
  return NextResponse.json({ sections: data });
}
