import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toggleToolFavorite, getFavoriteToolCodes } from "@/lib/ai-center";

export const runtime = "nodejs";

/** POST /api/ai/favorites — marca/desmarca uma ferramenta como favorita. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const toolCode = typeof body.tool_code === "string" ? body.tool_code : "";
  if (!toolCode) return NextResponse.json({ error: "Ferramenta não informada" }, { status: 400 });

  const ok = await toggleToolFavorite(user.id, toolCode, Boolean(body.favorite));
  if (!ok) return NextResponse.json({ error: "Não foi possível atualizar o favorito." }, { status: 500 });

  const favorites = await getFavoriteToolCodes(user.id);
  return NextResponse.json({ success: true, favorites });
}
