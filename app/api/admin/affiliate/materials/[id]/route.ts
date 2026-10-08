import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

async function requireSuperAdmin() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  return null;
}

function sanitize(body: Record<string, unknown>) {
  const kind = String(body.kind || "imagem");
  const format = String(body.format || "feed_1x1");
  const out: Record<string, unknown> = {};
  if (body.title !== undefined) out.title = String(body.title).trim().slice(0, 120);
  if (body.description !== undefined) {
    out.description = body.description ? String(body.description).slice(0, 500) : null;
  }
  if (body.kind !== undefined) out.kind = ["imagem", "video"].includes(kind) ? kind : "imagem";
  if (body.format !== undefined) {
    out.format = ["feed_1x1", "feed_4x5", "story_9x16"].includes(format) ? format : "feed_1x1";
  }
  if (body.file_url !== undefined) out.file_url = String(body.file_url).trim();
  if (body.thumbnail_url !== undefined) {
    out.thumbnail_url = body.thumbnail_url ? String(body.thumbnail_url).trim() : null;
  }
  if (body.file_size_bytes !== undefined) {
    out.file_size_bytes =
      body.file_size_bytes === null || body.file_size_bytes === ""
        ? null
        : Math.max(0, Math.round(Number(body.file_size_bytes) || 0));
  }
  if (body.width !== undefined) {
    out.width = body.width === null || body.width === "" ? null : Math.max(1, Math.round(Number(body.width) || 0));
  }
  if (body.height !== undefined) {
    out.height = body.height === null || body.height === "" ? null : Math.max(1, Math.round(Number(body.height) || 0));
  }
  if (body.active !== undefined) out.active = body.active !== false;
  if (body.sort_order !== undefined) out.sort_order = Math.round(Number(body.sort_order) || 0);
  // feed_4x5 (1080x1350) é exclusivo de imagens.
  if (out.format === "feed_4x5" && out.kind !== undefined && out.kind !== "imagem") {
    out.format = "feed_1x1";
  }
  return out;
}

/**
 * Traduz erro de CHECK do banco em mensagem acionável.
 * Caso conhecido: a migration 0056 (formato Feed 4:5) ainda não aplicada —
 * o CHECK antigo de `affiliate_materials` rejeita format = 'feed_4x5'.
 */
function dbErrorResponse(err: { code?: string; message?: string }, fallback: string) {
  const msg = String(err.message || "");
  if (err.code === "23514" || /affiliate_materials_format_check/i.test(msg)) {
    return NextResponse.json(
      {
        error:
          "Banco ainda sem a migration 0056: o formato Feed 4:5 (1080×1350) não é aceito pelo banco. Rode supabase/migrations/0056_affiliate_material_format_feed_4x5.sql no SQL Editor do Supabase e tente novamente.",
        pendingMigration: "0056",
      },
      { status: 409 }
    );
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** PUT /api/admin/affiliate/materials/[id] — atualiza material. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const body = (await request.json()) as Record<string, unknown>;
  const payload = sanitize(body);
  if (payload.title === "") return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_materials")
    .update(payload)
    .eq("id", params.id)
    .select()
    .single();
  if (error) return dbErrorResponse(error, "Erro ao atualizar material.");
  return NextResponse.json({ success: true, material: data });
}

/** DELETE /api/admin/affiliate/materials/[id] — exclui material. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const admin = createAdminClient();
  const { error } = await admin.from("affiliate_materials").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "Erro ao excluir material." }, { status: 500 });
  return NextResponse.json({ success: true });
}
