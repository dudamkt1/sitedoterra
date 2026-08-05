import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify, isValidSlug } from "@/lib/utils";

/**
 * Verificação de disponibilidade de slug em tempo real.
 * GET /api/slug/check?slug=joao
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("slug") || "";
  const slug = slugify(raw);

  const response: { slug: string; valid: boolean; available: boolean; reason?: string } = {
    slug,
    valid: false,
    available: false,
  };

  if (!raw.trim()) {
    response.reason = "Informe um nome de usuário.";
    return NextResponse.json(response);
  }

  if (slug !== raw.trim()) {
    response.reason = "O nome contém caracteres inválidos ou espaços. Usamos apenas letras, números e hífens.";
    return NextResponse.json(response);
  }

  if (!isValidSlug(slug)) {
    response.reason = "Nome inválido. Use 2-40 caracteres (letras minúsculas, números e hífen). Evite palavras reservadas e traços em sequência.";
    return NextResponse.json(response);
  }

  response.valid = true;

  const admin = createAdminClient();
  const { data } = await admin.rpc("is_slug_available", { p_slug: slug, p_exclude_user_id: null });

  if (data) {
    response.available = true;
  } else {
    response.available = false;
    response.reason = "Este nome de usuário já está em uso. Tente outra opção.";
  }

  return NextResponse.json(response);
}
