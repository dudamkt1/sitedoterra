import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getAccountCreditBreakdown } from "@/lib/affiliate-credit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Saldo em Conta": crédito manual do superadmin para um usuário.
 *
 *   GET    /api/admin/users/[id]/credit            → { credit, grants }
 *   POST   /api/admin/users/[id]/credit            → { amount, kind } cria
 *   PATCH  /api/admin/users/[id]/credit            → { grantId, amount, kind } edita
 *   DELETE /api/admin/users/[id]/credit?grantId=…  → exclui
 *
 * O saldo (credit) é sempre recalculado das concessões ativas menos o que já foi
 * consumido no checkout — exatamente a MESMA função usada em /painel/conta e no
 * sistema de pagamento (get_account_credit_available). Por isso editar/excluir
 * uma concessão sincroniza automaticamente o painel do usuário e o checkout.
 *
 * Os valores trafegam em CENTAVOS; o banco guarda em REAIS (numeric).
 */
const CREDIT_KINDS = ["activation", "subscription", "both"] as const;
type CreditKind = (typeof CREDIT_KINDS)[number];

const affectsActivation = (kind: string) => kind === "activation" || kind === "both";
const affectsSubscription = (kind: string) => kind === "subscription" || kind === "both";

interface GrantRow {
  id: string;
  kind: CreditKind;
  amount: number | string;
  status: string;
  created_at: string;
}

function authorize(actorProfile: { role?: string } | null | undefined) {
  return actorProfile?.role === "superadmin";
}

function serializeGrant(g: GrantRow) {
  return {
    id: g.id,
    kind: g.kind,
    amountCents: Math.round(Number(g.amount) * 100),
    status: g.status,
    createdAt: g.created_at,
  };
}

/** GET: saldo atual (breakdown) + lista de concessões, para o superadmin gerenciar. */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (!authorize(actorProfile)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id: userId } = params;
  if (!userId) return NextResponse.json({ error: "ID do usuário não informado." }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: grants }, credit] = await Promise.all([
    admin
      .from("account_credit_grants")
      .select("id, kind, amount, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    getAccountCreditBreakdown(userId),
  ]);

  return NextResponse.json({
    credit,
    grants: ((grants || []) as GrantRow[]).map(serializeGrant),
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (!authorize(actorProfile)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id: userId } = params;
  const body = await request.json();
  const amountCents = Math.round(Number(body.amount));
  const amountReais = amountCents / 100;
  const kind = String(body.kind || "").trim();

  if (!userId) return NextResponse.json({ error: "ID do usuário não informado." }, { status: 400 });
  if (!amountCents || amountCents <= 0) return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });
  if (!CREDIT_KINDS.includes(kind as CreditKind)) {
    return NextResponse.json({ error: "Tipo de crédito inválido. Use 'activation', 'subscription' ou 'both'." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: user } = await admin.from("profiles").select("user_id, role").eq("user_id", userId).maybeSingle();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

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

/** PATCH: edita valor e/ou tipo de uma concessão já existente. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (!authorize(actorProfile)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id: userId } = params;
  const body = await request.json();
  const grantId = String(body.grantId || "").trim();
  const amountCents = Math.round(Number(body.amount));
  const amountReais = amountCents / 100;
  const kind = String(body.kind || "").trim();

  if (!userId) return NextResponse.json({ error: "ID do usuário não informado." }, { status: 400 });
  if (!grantId) return NextResponse.json({ error: "Concessão não informada." }, { status: 400 });
  if (!amountCents || amountCents <= 0) return NextResponse.json({ error: "Informe um valor maior que zero. Para zerar, exclua a concessão." }, { status: 400 });
  if (!CREDIT_KINDS.includes(kind as CreditKind)) {
    return NextResponse.json({ error: "Tipo de crédito inválido. Use 'activation', 'subscription' ou 'both'." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("account_credit_grants")
    .select("id, kind, amount, status")
    .eq("id", grantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!grant) return NextResponse.json({ error: "Concessão não encontrada." }, { status: 404 });
  if (grant.status !== "active") {
    return NextResponse.json({ error: "Esta concessão não está ativa." }, { status: 400 });
  }

  // Trava de segurança: não permitir reduzir/trocar além do que ainda não foi
  // usado. Isso evita "dívida fantasma" e mantém o saldo consistente com o que
  // já foi consumido no checkout.
  const breakdown = await getAccountCreditBreakdown(userId);
  const oldCents = Math.round(Number(grant.amount) * 100);
  const oldAct = affectsActivation(grant.kind) ? oldCents : 0;
  const oldSub = affectsSubscription(grant.kind) ? oldCents : 0;
  const newAct = affectsActivation(kind) ? amountCents : 0;
  const newSub = affectsSubscription(kind) ? amountCents : 0;
  if (
    breakdown.activationCents - oldAct + newAct < 0 ||
    breakdown.subscriptionCents - oldSub + newSub < 0 ||
    breakdown.totalCents - oldCents + amountCents < 0
  ) {
    return NextResponse.json(
      { error: "Parte deste crédito já foi utilizada pelo usuário. Não é possível reduzir ou alterar abaixo do valor já gasto." },
      { status: 400 }
    );
  }

  const { error: updateError } = await admin
    .from("account_credit_grants")
    .update({ amount: amountReais, kind, updated_at: new Date().toISOString() })
    .eq("id", grantId)
    .eq("user_id", userId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  const credit = await getAccountCreditBreakdown(userId);
  const { data: grants } = await admin
    .from("account_credit_grants")
    .select("id, kind, amount, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    success: true,
    credit,
    grants: ((grants || []) as GrantRow[]).map(serializeGrant),
  });
}

/** DELETE: exclui uma concessão (somente se ainda houver saldo não consumido). */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (!authorize(actorProfile)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id: userId } = params;
  const grantId = new URL(request.url).searchParams.get("grantId")?.trim() || "";
  if (!userId) return NextResponse.json({ error: "ID do usuário não informado." }, { status: 400 });
  if (!grantId) return NextResponse.json({ error: "Concessão não informada." }, { status: 400 });

  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("account_credit_grants")
    .select("id, kind, amount, status")
    .eq("id", grantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!grant) return NextResponse.json({ error: "Concessão não encontrada." }, { status: 404 });

  // Trava de segurança: só exclui o que ainda não foi consumido.
  if (grant.status === "active") {
    const breakdown = await getAccountCreditBreakdown(userId);
    const oldCents = Math.round(Number(grant.amount) * 100);
    const oldAct = affectsActivation(grant.kind) ? oldCents : 0;
    const oldSub = affectsSubscription(grant.kind) ? oldCents : 0;
    if (breakdown.activationCents < oldAct || breakdown.subscriptionCents < oldSub || breakdown.totalCents < oldCents) {
      return NextResponse.json(
        { error: "Parte deste crédito já foi utilizada pelo usuário e não pode ser excluída." },
        { status: 400 }
      );
    }
  }

  const { error: deleteError } = await admin
    .from("account_credit_grants")
    .delete()
    .eq("id", grantId)
    .eq("user_id", userId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  const credit = await getAccountCreditBreakdown(userId);
  const { data: grants } = await admin
    .from("account_credit_grants")
    .select("id, kind, amount, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    success: true,
    credit,
    grants: ((grants || []) as GrantRow[]).map(serializeGrant),
  });
}
