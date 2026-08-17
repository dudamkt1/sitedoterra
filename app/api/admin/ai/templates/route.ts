import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getAiTemplates } from "@/lib/ai-center";

export const runtime = "nodejs";

/** GET /api/admin/ai/templates — lista todos os templates (Super Admin). */
export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const templates = await getAiTemplates(true);
  return NextResponse.json({ templates });
}

/** POST /api/admin/ai/templates — cria/atualiza/ativa/desativa/remove templates (Super Admin). */
export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient();
  const body = await request.json();
  const action = String(body.action || "update");

  if (action === "create") {
    const code = String(body.code || "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!code) return NextResponse.json({ error: "Código do template é obrigatório" }, { status: 400 });
    const { data: maxRow } = await admin.from("ai_templates").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const nextOrder = ((maxRow && (maxRow[0]?.sort_order as number)) || 0) + 10;
    const { data, error } = await admin
      .from("ai_templates")
      .insert({
        code,
        name: body.name || code,
        emoji: body.emoji || "🎨",
        category: body.category || "redes",
        description: body.description || null,
        structure: body.structure && typeof body.structure === "object" ? body.structure : {},
        enabled: body.enabled !== false,
        sort_order: nextOrder,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: "Erro ao criar template" }, { status: 500 });
    return NextResponse.json({ success: true, template: data });
  }

  if (action === "update") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Template não informado" }, { status: 400 });
    const payload: Record<string, unknown> = {};
    if (body.name !== undefined) payload.name = String(body.name);
    if (body.emoji !== undefined) payload.emoji = String(body.emoji);
    if (body.category !== undefined) payload.category = String(body.category);
    if (body.description !== undefined) payload.description = body.description || null;
    if (body.structure !== undefined && typeof body.structure === "object") payload.structure = body.structure;
    if (body.enabled !== undefined) payload.enabled = Boolean(body.enabled);
    if (body.sort_order !== undefined) payload.sort_order = Math.round(Number(body.sort_order) || 0);
    const { error } = await admin.from("ai_templates").update(payload).eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao atualizar template" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "toggle") {
    const id = String(body.id || "");
    const enabled = Boolean(body.enabled);
    const { error } = await admin.from("ai_templates").update({ enabled }).eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao atualizar template" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const id = String(body.id || "");
    const { error } = await admin.from("ai_templates").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao remover template" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
