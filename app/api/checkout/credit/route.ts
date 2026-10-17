import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAffiliateCreditBalance } from "@/lib/affiliate-credit";

export const runtime = "nodejs";

/**
 * GET /api/checkout/credit?type=activation|subscription — saldo de crédito do
 * usuário logado (saldo de afiliado + "Saldo em Conta"). Usado pelo /checkout
 * para exibir "Você possui R$ X de crédito. Deseja utilizar?".
 * Retorna zeros quando a infra de crédito (migration 0045) ainda não existe.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("type");
  const kind = raw === "subscription" ? "subscription" : raw === "activation" ? "activation" : undefined;

  const { cents, enabled } = await getAffiliateCreditBalance(user.id, kind);
  return NextResponse.json({ available_cents: cents, enabled });
}
