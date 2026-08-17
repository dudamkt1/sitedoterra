import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteUserTemplate } from "@/lib/ai-center";

export const runtime = "nodejs";

interface Ctx {
  params: { id: string };
}

/** DELETE /api/ai/user-templates/[id] — remove um template salvo (só do próprio usuário). */
export async function DELETE(_request: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const ok = await deleteUserTemplate(user.id, params.id);
  if (!ok) return NextResponse.json({ error: "Não foi possível excluir o template." }, { status: 500 });
  return NextResponse.json({ success: true });
}
