import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAiTools, getAiTemplates, getHistory, getUserTemplates, getFavoriteToolCodes } from "@/lib/ai-center";
import { getAiSettings } from "@/lib/ai";
import { getEnabledProviders } from "@/lib/ai";
import { keyHint } from "@/lib/crypto";

export const runtime = "nodejs";

/**
 * GET /api/ai/catalog — carrega tudo que a Central de IA precisa em uma única
 * chamada: ferramentas, templates, histórico, favoritos e configuração.
 * Todo dado é do próprio usuário logado (isolamento multi-tenant).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [tools, templates, history, userTemplates, favorites, settings, providers] = await Promise.all([
    getAiTools(),
    getAiTemplates(),
    getHistory(user.id, 50),
    getUserTemplates(user.id),
    getFavoriteToolCodes(user.id),
    getAiSettings(user.id),
    getEnabledProviders(),
  ]);

  return NextResponse.json({
    tools,
    templates,
    history,
    userTemplates,
    favorites,
    settings: {
      provider_id: settings?.provider_id || null,
      has_key: Boolean(settings?.api_key_enc),
      key_hint: keyHint(settings?.api_key_enc),
    },
    providers,
  });
}
