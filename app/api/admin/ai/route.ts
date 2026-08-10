import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/admin/ai — lista todos os provedores de IA (Super Admin). */
export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("ai_providers").select("*").order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: "Erro ao carregar provedores" }, { status: 500 });
  return NextResponse.json({ providers: data });
}

/** POST /api/admin/ai — cria/atualiza/ativa/desativa provedores de IA. */
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
    if (!code) return NextResponse.json({ error: "Código do provedor é obrigatório" }, { status: 400 });
    const { data: maxRow } = await admin.from("ai_providers").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const nextOrder = (maxRow && (maxRow[0]?.sort_order as number) || 0) + 10;
    const { data, error } = await admin
      .from("ai_providers")
      .insert({
        code,
        name: body.name || code,
        enabled: body.enabled !== false,
        requires_api_key: body.requires_api_key !== false,
        free_tier: body.free_tier || null,
        limits: body.limits || null,
        docs_url: body.docs_url || null,
        base_url: body.base_url || null,
        model: body.model || null,
        instructions: body.instructions || null,
        sort_order: nextOrder,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: "Erro ao criar provedor" }, { status: 500 });
    return NextResponse.json({ success: true, provider: data });
  }

  if (action === "update") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Provedor não informado" }, { status: 400 });
    const payload: Record<string, unknown> = {};
    if (body.name !== undefined) payload.name = String(body.name);
    if (body.enabled !== undefined) payload.enabled = Boolean(body.enabled);
    if (body.requires_api_key !== undefined) payload.requires_api_key = Boolean(body.requires_api_key);
    if (body.free_tier !== undefined) payload.free_tier = body.free_tier || null;
    if (body.limits !== undefined) payload.limits = body.limits || null;
    if (body.docs_url !== undefined) payload.docs_url = body.docs_url || null;
    if (body.base_url !== undefined) payload.base_url = body.base_url || null;
    if (body.model !== undefined) payload.model = body.model || null;
    if (body.instructions !== undefined) payload.instructions = body.instructions || null;
    const { error } = await admin.from("ai_providers").update(payload).eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao atualizar provedor" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "toggle") {
    const id = String(body.id || "");
    const enabled = Boolean(body.enabled);
    const { error } = await admin.from("ai_providers").update({ enabled }).eq("id", id);
    if (error) return NextResponse.json({ error: "Erro ao atualizar provedor" }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
