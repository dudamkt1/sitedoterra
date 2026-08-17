import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getAiTools } from "@/lib/ai-center";

export const runtime = "nodejs";

/** GET /api/admin/ai/tools — lista todas as ferramentas da Central de IA (Super Admin). */
export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const tools = await getAiTools(true);
  return NextResponse.json({ tools });
}

/** POST /api/admin/ai/tools — cria/atualiza/ativa/desativa ferramentas (Super Admin). */
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
    if (!code) return NextResponse.json({ error: "Código da ferramenta é obrigatório" }, { status: 400 });
    const { data: maxRow } = await admin.from("ai_tools").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const nextOrder = ((maxRow && (maxRow[0]?.sort_order as number)) || 0) + 10;
    const examples = Array.isArray(body.examples) ? body.examples.map(String) : [];
    const { data, error } = await admin
      .from("ai_tools")
      .insert({
        code,
        name: body.name || code,
        emoji: body.emoji || "🤖",
        category: body.category || "conteudo",
        description: body.description || null,
        examples,
        enabled: body.enabled !== false,
        requires_api_key: body.requires_api_key !== false,
        base_prompt: body.base_prompt || null,
        sort_order: nextOrder,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: "Erro ao criar ferramenta" }, { status: 500 });
    return NextResponse.json({ success: true, tool: data });
  }

  if (action === "update") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Ferramenta não informada" }, { status: 400 });
    const payload: Record<string, unknown> = {};
    if (body.name !== undefined) payload.name = String(body.name);
    if (body.emoji !== undefined) payload.emoji = String(body.emoji);
    if (body.category !== undefined) payload.category = String(body.category);
    if (body.description !== undefined) payload.description = body.description || null;
    if (body.examples !== undefined) payload.examples = Array.isArray(body.examples) ? body.examples.map(String) : [];
    if (body.base_prompt !== undefined) payload.base_prompt = body.base_prompt || null;
    if (body.enabled !== undefined) payload.enabled = Boolean(body.enabled);
    if (body.requires_api_key !== undefined) payload.requires_api_key = Boolean(body.requires_api_key);
    if (body.sort_order !== undefined) payload.sort_order = Math.round(Number(body.sort_order) || 0);
    const { error } = await admin.from("ai_tools").update(payload).eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao atualizar ferramenta" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "toggle") {
    const id = String(body.id || "");
    const enabled = Boolean(body.enabled);
    const { error } = await admin.from("ai_tools").update({ enabled }).eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao atualizar ferramenta" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const id = String(body.id || "");
    const { error } = await admin.from("ai_tools").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao remover ferramenta" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
