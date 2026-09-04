import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getAffiliatePaymentMethod,
  upsertAffiliatePaymentMethod,
} from "@/lib/affiliate";
import type { AffiliatePayoutMethod, AffiliatePixKeyType } from "@/types";

/**
 * GET /api/affiliate/payment-method
 * Retorna os dados de recebimento cadastrados pelo afiliado autenticado.
 *
 * Resposta 200:
 *   { success: true, data: AffiliatePaymentMethod | null }
 *
 * Segurança:
 *  - Exige usuário autenticado.
 *  - Cada afiliado lê SOMENTE seus próprios dados (RLS + filtro por user_id).
 *  - Os dados de pagamento NUNCA são retornados para terceiros.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const pm = await getAffiliatePaymentMethod(user.id);
  return NextResponse.json({ success: true, data: pm });
}

/**
 * PUT /api/affiliate/payment-method
 * Cadastra/atualiza os dados de recebimento do afiliado autenticado.
 *
 * Body:
 *   {
 *     method: "pix" | "mercado_pago",
 *     pixKeyType?: "cpf_cnpj" | "email" | "phone" | "random",
 *     pixKey?: string,
 *     mpEmail?: string
 *   }
 *
 * Resposta 200:
 *   { success: true, data: AffiliatePaymentMethod }
 * Resposta 400:
 *   { success: false, error: string }
 *
 * Segurança:
 *  - Exige usuário autenticado.
 *  - A função utilitária `upsertAffiliatePaymentMethod` valida tipos/formato
 *    antes de gravar.
 *  - UPSERT filtrado por user_id do JWT (não é possível gravar dados de
 *    outro afiliado — RLS + admin client com auth.uid() garantem isso).
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const method = body?.method as AffiliatePayoutMethod | undefined;

  if (!method || !["pix", "mercado_pago"].includes(method)) {
    return NextResponse.json(
      { success: false, error: "Método de recebimento inválido." },
      { status: 400 }
    );
  }

  const result = await upsertAffiliatePaymentMethod({
    userId: user.id,
    method,
    pixKeyType: (body?.pixKeyType as AffiliatePixKeyType | null) || null,
    pixKey: (body?.pixKey as string | null) || null,
    mpEmail: (body?.mpEmail as string | null) || null,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data });
}