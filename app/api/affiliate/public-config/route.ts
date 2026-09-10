import { NextResponse } from "next/server";
import { getPublicAffiliateConfig } from "@/lib/affiliate-public";

export const runtime = "nodejs";

/**
 * GET /api/affiliate/public-config — PÚBLICO (sem login).
 *
 * Expõe somente o necessário para as páginas públicas do Programa de
 * Afiliados (/afiliados e a chamada na home): percentual vigente, mínimo de
 * saque e valor de ativação. Nenhum segredo ou dado de usuário.
 */
export async function GET() {
  return NextResponse.json(await getPublicAffiliateConfig());
}
