import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateWithAi } from "@/lib/ai";

export const runtime = "nodejs";

/** POST /api/ai/generate — gera conteúdo usando a IA configurada pelo usuário. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const kind = typeof body.kind === "string" ? body.kind : "default";
  const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, 2000) : "";
  const context = typeof body.context === "string" ? body.context.slice(0, 2000) : "";

  const result = await generateWithAi(user.id, { kind, prompt, context });
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Erro ao gerar conteúdo" }, { status: 502 });
  }
  return NextResponse.json({ text: result.text });
}
