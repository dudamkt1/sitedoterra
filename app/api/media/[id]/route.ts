import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { r2DeleteObject } from "@/lib/r2";
import { mediaContext, MediaError, findMediaReferences } from "@/lib/media";

export const runtime = "nodejs";

/**
 * DELETE /api/media/[id]
 * Exclui uma mídia (R2 + metadados) com isolamento multi-tenant e
 * proteção de referência: se o arquivo ainda é usado em conteúdo, bloqueia
 * a exclusão e lista onde está sendo usado.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
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

  const { data: media, error } = await admin
    .from("media_files")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !media) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  // Isolamento: dono OU superadmin.
  if (media.user_id !== ctx.user.id && !ctx.isSuperAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Checagem de referências (não exclui arquivo em uso sem confirmação explícita).
  const scope = media.tenant_id ? "tenant" : "system";
  const refs = await findMediaReferences({
    storageKey: media.storage_key,
    publicUrl: media.public_url || "",
    scope,
    tenantId: media.tenant_id,
  });

  if (refs.length > 0) {
    return NextResponse.json(
      {
        error:
          "Esta imagem está sendo utilizada em uma ou mais áreas do site. Deseja realmente excluir?",
        references: refs.map((r) => r.label),
        requiresConfirmation: true,
      },
      { status: 409 }
    );
  }

  // Remove física + lógica.
  await r2DeleteObject(media.storage_key);
  await admin.from("media_files").delete().eq("id", media.id);
  await admin.from("media_actions").insert({
    media_id: media.id,
    tenant_id: media.tenant_id,
    user_id: ctx.user.id,
    action: "delete",
    details: { storage_key: media.storage_key, category: media.category },
  });

  return NextResponse.json({ success: true });
}