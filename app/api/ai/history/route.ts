import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getHistory } from "@/lib/ai-center";

export const runtime = "nodejs";

/** GET /api/ai/history — lista o histórico de gerações do usuário logado. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const history = await getHistory(user.id);
  return NextResponse.json({ history });
}
