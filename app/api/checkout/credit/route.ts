import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAffiliateCreditBalance } from "@/lib/affiliate-credit";

export const runtime = "nodejs";

/**
 * GET /api/checkout/credit — saldo de crédito de afiliado do usuário logado.
 * Usado pelo /checkout para exibir "Você possui R$ X de crédito. Deseja utilizar?".
 * Retorna zeros quando a infra de crédito (migration 0045) ainda não existe.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { cents, enabled } = await getAffiliateCreditBalance(user.id);
  return NextResponse.json({ available_cents: cents, enabled });
}
