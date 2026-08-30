import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

const VALID_TYPES = new Set(["suggestion", "question", "criticism", "problem", "praise", "other"]);

/**
 * POST /api/feedback
 * Usuário autenticado envia uma mensagem de feedback.
 * user_id, user_name, user_email são preenchidos a partir da SESSÃO
 * — o cliente NUNCA é confiável para identificar o remetente.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para enviar uma mensagem." }, { status: 401 });
  }
  const profile = await getProfile(user.id);
  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    message?: string;
    source_page?: string;
  };

  const type = (body.type || "").toString().toLowerCase();
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "Tipo de mensagem inválido." }, { status: 400 });
  }
  const message = (body.message || "").toString().trim();
  if (message.length < 1) {
    return NextResponse.json({ error: "A mensagem não pode estar vazia." }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Mensagem muito longa (máx. 4000 caracteres)." }, { status: 400 });
  }

  const sourcePage = (body.source_page || "").toString().slice(0, 300) || null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_feedback")
    .insert({
      user_id: user.id,
      user_name: profile.name || null,
      user_email: profile.email,
      type,
      message,
      status: "pending",
      source_page: sourcePage,
    })
    .select("id, type, status, created_at")
    .single();

  if (error) {
    console.error("[feedback] insert error:", error.message);
    return NextResponse.json({ error: "Não foi possível enviar a mensagem. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, feedback: data });
}
