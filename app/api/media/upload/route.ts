import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isR2Configured, r2PutObject, r2PublicUrl, r2DeleteObject } from "@/lib/r2";
import {
  mediaContext,
  validateUpload,
  makeStorageKey,
  MediaError,
  getMediaQuotaBytes,
  getTenantStorageUsed,
  toMediaView,
} from "@/lib/media";

export const runtime = "nodejs";

/**
 * POST /api/media/upload  (multipart/form-data)
 * file | category | scope
 *
 * Upload SERVIDOR-PARA-SERVIDOR: o browser envia o binário à API e o servidor
 * faz o PUT ao R2 (sem CORS/preflight). Fallback confiável quando o upload
 * direto do browser (presign) falha por CORS do bucket.
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

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Formato inválido (use multipart/form-data)." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "Arquivo ausente ou vazio." }, { status: 400 });
  }

  const category = String(form.get("category") || "general");
  const scope: "tenant" | "system" = form.get("scope") === "system" ? "system" : "tenant";
  if (scope === "system" && !ctx.isSuperAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileSize = buffer.length;

  let validation;
  try {
    validation = validateUpload({
      category,
      mimeType: file.type,
      fileName: file.name,
      fileSize,
    });
  } catch (err) {
    if (err instanceof MediaError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }

  const tenantId = scope === "tenant" ? ctx.tenant.id : null;

  // Quota (apenas tenants).
  if (scope === "tenant") {
    const [used, quota] = await Promise.all([
      getTenantStorageUsed(ctx.tenant.id),
      getMediaQuotaBytes(ctx.tenant.id),
    ]);
    if (used + fileSize > quota) {
      return NextResponse.json(
        {
          error:
            `Seu espaço de armazenamento foi atingido (${Math.ceil(used / 1024 / 1024)}/${Math.ceil(quota / 1024 / 1024)} MB). Exclua arquivos antigos ou altere seu plano.`,
        },
        { status: 413 }
      );
    }
  }

  const storageKey = makeStorageKey({
    scope,
    tenantId,
    category: validation.category,
    extension: validation.extension,
  });
  const publicUrl = r2PublicUrl(storageKey);

  // PUT ao R2 pelo servidor (sem CORS).
  try {
    await r2PutObject({
      key: storageKey,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    });
  } catch (err) {
    console.error("Erro no upload server-side ao R2", err);
    return NextResponse.json(
      { error: "Falha ao enviar o arquivo ao armazenamento. Tente novamente." },
      { status: 500 }
    );
  }

  const { data: media, error } = await admin
    .from("media_files")
    .insert({
      tenant_id: tenantId,
      user_id: ctx.user.id,
      storage_key: storageKey,
      public_url: publicUrl,
      original_name: validation.cleanName,
      file_name: storageKey.split("/").pop() || null,
      mime_type: file.type || "application/octet-stream",
      file_size: fileSize,
      category: validation.category.code,
      folder: validation.category.folder,
      is_public: true,
      status: "uploaded",
    })
    .select("*")
    .single();

  if (error || !media) {
    await r2DeleteObject(storageKey).catch(() => {});
    console.error("Erro ao registrar mídia no banco", error);
    return NextResponse.json({ error: "Erro ao registrar o arquivo" }, { status: 500 });
  }

  await admin.from("media_actions").insert({
    media_id: media.id,
    tenant_id: tenantId,
    user_id: ctx.user.id,
    action: "upload",
    details: { size: fileSize, mime: file.type, category: validation.category.code, via: "server" },
  });

  return NextResponse.json({ media: toMediaView(media) });
}