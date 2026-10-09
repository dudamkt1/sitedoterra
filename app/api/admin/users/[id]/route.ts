import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Super Admin cria crédito para um usuário.
 * POST /api/admin/users/[id]/credit  body: { amount, kind }
 *
 * kind: "activation" | "subscription"
 * O crédito ficará disponível no checkout do usuário e será descontado do saldo
 * de comissões do afiliado. Somente crédito do tipo "activation" pode ser
 * utilizado na ativação do site (não em mensalidade).
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id: userId } = params;
  const body = await request.json();
  const amount = Number(body.amount);
  const kind = String(body.kind || "").trim();

  if (!userId) return NextResponse.json({ error: "ID do usuário não informado." }, { status: 400 });
  if (!amount || amount <= 0) return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });
  if (kind !== "activation" && kind !== "subscription") {
    return NextResponse.json({ error: "Tipo de crédito inválido. Use 'activation' ou 'subscription'." }, { status: 400 });
  }

  // Verifica se o usuário existe
  const admin = createAdminClient();
  const { data: user } = await admin.from("profiles").select("user_id, role").eq("user_id", userId).maybeSingle();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  // Reserva o crédito no sistema de affiliate credit
  const { data: usage, error: usageError } = await admin.rpc("reserve_affiliate_credit", {
    p_user_id: userId,
    p_amount: amount,
    p_tenant_id: null,
    p_kind: kind,
    p_metadata: JSON.stringify({ created_by_superadmin: true, source: "admin_panel" }),
  });

  if (usageError) return NextResponse.json({ error: usageError.message }, { status: 400 });

  return NextResponse.json({ success: true, usageId: usage.id, amount, kind });
}