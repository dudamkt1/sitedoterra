import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import {
  listPortfolioModels,
  selectPortfolioModelForTenant,
  toModelCard,
} from "@/lib/portfolio";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * ESCOLHA DO MODELO DE SITE pelo usuário (antes/durante a ativação).
 *
 * GET  -> modelos disponíveis + o escolhido pelo tenant atual.
 * POST -> registra `tenants.portfolio_model_id`.
 *
 * O modelo escolhido é lido APENAS na ativação (a primeira cópia das seções).
 * Depois que o site nasceu, o endpoint recusa a troca (409): o site é uma
 * cópia independente e não pode ser recriado por causa de uma troca.
 */
export async function GET() {
  const user = await getCurrentUser();
  const models = await listPortfolioModels();

  // Visitante deslogado (1ª etapa do checkout): o CATÁLOGO é público — é o
  // mesmo de /portfolio. Sem sessão não há tenant, então não há modelo
  // "atual" nem status: a escolha fica no cliente e é gravada no servidor
  // junto com o pagamento (body.portfolioModelKey em POST /api/checkout).
  if (!user) {
    return NextResponse.json({
      models: models.map(toModelCard),
      currentKey: null,
      siteStatus: null,
    });
  }

  const tenant = await ensureTenantForUser(user.id);
  let currentKey: string | null = null;
  if (tenant) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("tenants")
        .select("portfolio_model_id")
        .eq("id", tenant.id)
        .maybeSingle();
      const id = (data as { portfolio_model_id?: string | null } | null)?.portfolio_model_id;
      if (id) currentKey = models.find((m) => m.id === id)?.key || null;
    } catch {
      currentKey = null;
    }
  }

  return NextResponse.json({
    models: models.map(toModelCard),
    currentKey,
    siteStatus: tenant?.site_status || null,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const modelKey = typeof body.modelKey === "string" ? body.modelKey.trim() : "";
  if (!modelKey) return NextResponse.json({ error: "Informe o modelo." }, { status: 400 });

  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });

  const result = await selectPortfolioModelForTenant(tenant.id, modelKey);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, model: toModelCard(result.model) });
}
