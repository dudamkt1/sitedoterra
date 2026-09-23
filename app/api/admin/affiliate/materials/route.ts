import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

async function requireSuperAdmin() {
  const actor = await getCurrentUser();
  if (!actor) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }
  return { error: null as null, actor };
}

function sanitize(body: Record<string, unknown>) {
  const kind = String(body.kind || "imagem");
  const format = String(body.format || "feed_1x1");
  return {
    title: String(body.title || "").trim().slice(0, 120),
    description: body.description ? String(body.description).slice(0, 500) : null,
    kind: (["imagem", "video"].includes(kind) ? kind : "imagem") as "imagem" | "video",
    format: (["feed_1x1", "story_9x16"].includes(format) ? format : "feed_1x1") as
      | "feed_1x1"
      | "story_9x16",
    file_url: String(body.file_url || "").trim(),
    thumbnail_url: body.thumbnail_url ? String(body.thumbnail_url).trim() : null,
    file_size_bytes:
      body.file_size_bytes === null || body.file_size_bytes === undefined || body.file_size_bytes === ""
        ? null
        : Math.max(0, Math.round(Number(body.file_size_bytes) || 0)),
    width:
      body.width === null || body.width === undefined || body.width === ""
        ? null
        : Math.max(1, Math.round(Number(body.width) || 0)),
    height:
      body.height === null || body.height === undefined || body.height === ""
        ? null
        : Math.max(1, Math.round(Number(body.height) || 0)),
    active: body.active !== false,
    sort_order: Math.round(Number(body.sort_order) || 0),
  };
}

/** GET /api/admin/affiliate/materials — lista todos (ativos e inativos). */
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  const admin = createAdminClient();
  const { data, error: err } = await admin
    .from("affiliate_materials")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (err) {
    // Tabela ainda sem migration aplicada: lista vazia em vez de 500.
    if (/affiliate_materials/i.test(err.message || "")) {
      return NextResponse.json({ success: true, materials: [], missingMigration: true });
    }
    return NextResponse.json({ error: "Erro ao listar materiais." }, { status: 500 });
  }
  return NextResponse.json({ success: true, materials: data || [] });
}

/** POST /api/admin/affiliate/materials — cria material. */
export async function POST(request: Request) {
  const { error, actor } = await requireSuperAdmin();
  if (error) return error;
  const body = (await request.json()) as Record<string, unknown>;
  const payload = sanitize(body);
  if (!payload.title) return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });
  if (!payload.file_url) return NextResponse.json({ error: "Envie o arquivo do material." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error: err } = await admin
    .from("affiliate_materials")
    .insert({ ...payload, created_by: actor!.id })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao criar material." }, { status: 500 });
  return NextResponse.json({ success: true, material: data });
}
