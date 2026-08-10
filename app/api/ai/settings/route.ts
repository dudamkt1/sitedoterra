import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEnabledProviders, getAiSettings, saveAiSettings } from "@/lib/ai";
import { keyHint } from "@/lib/crypto";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [settings, providers] = await Promise.all([getAiSettings(user.id), getEnabledProviders()]);

  return NextResponse.json({
    settings: {
      provider_id: settings?.provider_id || null,
      has_key: Boolean(settings?.api_key_enc),
      key_hint: keyHint(settings?.api_key_enc),
    },
    providers,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const providerId = body.provider_id ? String(body.provider_id) : null;
  const apiKey = typeof body.api_key === "string" && body.api_key.trim() ? body.api_key.trim() : null;

  try {
    await saveAiSettings(user.id, providerId, apiKey);
  } catch {
    return NextResponse.json({ error: "Erro ao salvar a configuração de IA." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
