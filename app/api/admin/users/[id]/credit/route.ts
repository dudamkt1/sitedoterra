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
 * O crédito vira um "Saldo em Conta" (concessão manual) do usuário. É
 * INDEPENDENTE do saldo de comissões de afiliado e fica disponível como
 * desconto no checkout (pode ser combinado com o saldo de afiliado).
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
  // O painel envia o valor em CENTAVOS; o banco guarda em REAIS (numeric).
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

  // Cria a concessão de "Saldo em Conta" (crédito manual do superadmin).
  // Não há verificação de saldo: o crédito é concedido, não descontado de
  // comissões. Valores em REAIS.
  const { data: grant, error: grantError } = await admin
    .from("account_credit_grants")
    .insert({
      user_id: userId,
      kind,
      amount: amountReais,
      status: "active",
      metadata: { created_by_superadmin: true, source: "admin_panel" },
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (grantError) {
    return NextResponse.json({ error: grantError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, grantId: grant.id, amountCents, amount: amountCents, kind });
}
