import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Super Admin cria crédito para um usuário.
 * POST /api/admin/users/[id]/credit  body: { amount, kind }
 *
 * kind:
 *   - "activation"   → usável na ativação do site
 *   - "subscription" → usável na mensalidade
 *   - "both"         → usável na ativação E na mensalidade
 *
 * O crédito é descontado do saldo de comissões do afiliado e fica disponível
 * como desconto no checkout do usuário.
 */
const CREDIT_KINDS = ["activation", "subscription", "both"] as const;
type CreditKind = (typeof CREDIT_KINDS)[number];

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
  // O painel envia o valor em CENTAVOS; a RPC reserve_affiliate_credit trabalha
  // em REAIS (numeric, mesma unidade de get_affiliate_balance). Sem a conversão
  // o valor entrava 100x maior e a reserva falhava com INSUFFICIENT_BALANCE.
  const amountCents = Math.round(Number(body.amount));
  const amountReais = amountCents / 100;
  const kind = String(body.kind || "").trim();

  if (!userId) return NextResponse.json({ error: "ID do usuário não informado." }, { status: 400 });
  if (!amountCents || amountCents <= 0) return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });
  if (!CREDIT_KINDS.includes(kind as CreditKind)) {
    return NextResponse.json({ error: "Tipo de crédito inválido. Use 'activation', 'subscription' ou 'both'." }, { status: 400 });
  }

  // Verifica se o usuário existe
  const admin = createAdminClient();
  const { data: user } = await admin.from("profiles").select("user_id, role").eq("user_id", userId).maybeSingle();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  // Reserva o crédito no sistema de affiliate credit (valores em REAIS).
  const { data: usage, error: usageError } = await admin.rpc("reserve_affiliate_credit", {
    p_user_id: userId,
    p_amount: amountReais,
    p_tenant_id: null,
    p_kind: kind,
    p_metadata: JSON.stringify({ created_by_superadmin: true, source: "admin_panel" }),
  });

  if (usageError) {
    const msg = usageError.message || "";
    if (msg.includes("INSUFFICIENT_BALANCE")) {
      return NextResponse.json(
        { error: "Saldo de comissões do afiliado insuficiente para este crédito." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ success: true, usageId: usage.id, amountCents, amount: amountCents, kind });
}
