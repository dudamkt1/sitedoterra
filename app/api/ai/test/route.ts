import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { testProviderConnection } from "@/lib/ai";

export const runtime = "nodejs";

/** POST /api/ai/test — testa a conexão com o provedor usando a chave salva. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const providerId = String(body.provider_id || "");
  if (!providerId) return NextResponse.json({ error: "Provedor não informado" }, { status: 400 });

  const result = await testProviderConnection(user.id, providerId);
  return NextResponse.json(result);
}
