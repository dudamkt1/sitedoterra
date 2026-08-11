import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isR2Configured, r2HeadObject, r2PublicUrl } from "@/lib/r2";
import { mediaContext, MediaError, toMediaView } from "@/lib/media";

export const runtime = "nodejs";

/**
 * POST /api/media/complete
 * Confirma um upload enviado direto ao R2: valida o objeto no bucket,
 * reconcilia tamanho e marca o metadado como 'uploaded'.
 * Documenta a ação em media_actions (auditoria).
 */
export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Armazenamento Cloudflare R2 não configurado." },
      { status: 503 }
    );
  }

  const admin = createAdminClient();

  let ctx;
  try {
    ctx = await mediaContext();
  } catch (err) {
    if (err instanceof MediaError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.id) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  }

  const { data: media, error } = await admin
    .from("media_files")
    .select("*")
    .eq("id", body.id)
    .maybeSingle();

  if (error || !media) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  // Isolamento: apenas o dono (ou superadmin) pode seguir.
  if (media.user_id !== ctx.user.id && !ctx.isSuperAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Confirma a existência física no R2.
  const head = await r2HeadObject(media.storage_key);
  if (!head) {
    await admin
      .from("media_files")
      .update({ status: "failed" })
      .eq("id", media.id);
    return NextResponse.json(
      { error: "Arquivo não chegou ao R2. Tente novamente." },
      { status: 400 }
    );
  }

  const { data: updated } = await admin
    .from("media_files")
    .update({
      status: "uploaded",
      file_size: head.size || media.file_size,
      public_url: r2PublicUrl(media.storage_key),
    })
    .eq("id", media.id)
    .select("*")
    .single();

  await admin.from("media_actions").insert({
    media_id: media.id,
    tenant_id: media.tenant_id,
    user_id: ctx.user.id,
    action: "upload",
    details: { size: head.size, mime: media.mime_type, category: media.category },
  });

  return NextResponse.json({ media: toMediaView(updated || media) });
}