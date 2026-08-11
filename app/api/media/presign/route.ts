import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isR2Configured, createPresignedPutUrl, r2PublicUrl } from "@/lib/r2";
import {
  mediaContext,
  validateUpload,
  makeStorageKey,
  MediaError,
  getMediaQuotaBytes,
  getTenantStorageUsed,
  sanitizeOriginalName,
  getMediaCategory,
} from "@/lib/media";

export const runtime = "nodejs";

/**
 * POST /api/media/presign
 * Reserva um arquivo e devolve uma URL pré-assinada (PUT) para o browser
 * enviar o binário DIRETAMENTE ao R2 (sem passar pela aplicação).
 *
 * - A sessão/tenant são resolvidos NO SERVIDOR (nunca aceito do frontend).
 * - Validação: categoria, MIME, extensão, tamanho e quota.
 *   - Validação de categoria, MIME, extensão, tamanho e quota.
 * - Insere metadados com status 'uploading'; /api/media/complete finaliza.
 */
export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Armazenamento Cloudflare R2 não configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET_NAME." },
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const scope: "tenant" | "system" = body.scope === "system" ? "system" : "tenant";
  if (scope === "system" && !ctx.isSuperAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // ---------- Validação do arquivo ----------
  let validation: ReturnType<typeof validateUpload>;
  try {
    validation = validateUpload({
      category: body.category,
      mimeType: body.mimeType,
      fileName: body.fileName,
      fileSize: Number(body.fileSize),
    });
  } catch (err) {
    if (err instanceof MediaError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }

  const fileSize = Number(body.fileSize);

  let tenantId: string | null = ctx.tenant.id;
  if (scope === "system") tenantId = null;

  // ---------- Quota de armazenamento (apenas tenants) ----------
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

  // ---------- Limpeza de reservas órfãs (status 'uploading' > 1h) ----------
  const staleCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await admin
    .from("media_files")
    .delete()
    .eq("user_id", ctx.user.id)
    .eq("status", "uploading")
    .lt("created_at", staleCutoff);

  // ---------- Chave + URL pré-assinada ----------
  const storageKey = makeStorageKey({
    scope,
    tenantId,
    category: validation.category,
    extension: validation.extension,
  });

  let uploadUrl: string;
  try {
    uploadUrl = await createPresignedPutUrl({
      key: storageKey,
      contentType: body.mimeType,
    });
  } catch (err) {
    console.error("Erro ao gerar presigned URL R2", err);
    return NextResponse.json(
      { error: "Não foi possível gerar a URL de upload. Verifique as credenciais do R2." },
      { status: 500 }
    );
  }

  const publicUrl = r2PublicUrl(storageKey);

  // ---------- Reserva do metadado ----------
  const { data: media, error } = await admin
    .from("media_files")
    .insert({
      tenant_id: tenantId,
      user_id: ctx.user.id,
      storage_key: storageKey,
      public_url: publicUrl,
      original_name: validation.cleanName,
      file_name: storageKey.split("/").pop() || null,
      mime_type: body.mimeType,
      file_size: fileSize,
      category: validation.category.code,
      folder: validation.category.folder,
      is_public: true,
      status: "uploading",
    })
    .select("*")
    .single();

  if (error || !media) {
    console.error("Erro ao registrar mídia no banco", error);
    return NextResponse.json({ error: "Erro ao registrar o arquivo" }, { status: 500 });
  }

  return NextResponse.json({
    id: media.id,
    storageKey,
    uploadUrl,
    publicUrl,
    category: validation.category.code,
    limitMb: Math.round(validation.category.maxBytes / 1024 / 1024),
  });
}