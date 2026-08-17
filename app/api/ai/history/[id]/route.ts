import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toggleHistoryFavorite, deleteHistory } from "@/lib/ai-center";

export const runtime = "nodejs";

interface Ctx {
  params: { id: string };
}

/** PATCH /api/ai/history/[id] — alterna favorito de um item do histórico (só do próprio usuário). */
export async function PATCH(request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const favorite = Boolean(body.favorite);
  const ok = await toggleHistoryFavorite(user.id, params.id, favorite);
  if (!ok) return NextResponse.json({ error: "Não foi possível atualizar o item." }, { status: 500 });
  return NextResponse.json({ success: true, favorite });
}

/** DELETE /api/ai/history/[id] — remove um item do histórico (só do próprio usuário). */
export async function DELETE(_request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const ok = await deleteHistory(user.id, params.id);
  if (!ok) return NextResponse.json({ error: "Não foi possível excluir o item." }, { status: 500 });
  return NextResponse.json({ success: true });
}
