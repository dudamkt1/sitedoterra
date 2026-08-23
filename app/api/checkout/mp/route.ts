import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { getActiveOffer } from "@/lib/commercial";
import { createActivationPreference, isMercadoPagoEnabled } from "@/lib/mercadopago";
import type { Plan } from "@/types";

export const runtime = "nodejs";

/**
 * Inicia o fluxo de contratação (ATIVAÇÃO) pelo Mercado Pago:
 *  - Cria uma Payment Preference (Checkout Pro — cartão de crédito e/ou PIX)
 *    usando os valores da configuração comercial (tabela plans).
 *  - A confirmação definitiva acontece pelo WEBHOOK (/api/webhooks/mercadopago),
 *    que registra o pagamento e cria a assinatura recorrente com primeira
 *    cobrança apenas após o período configurado em /admin/planos.
 *  - O frontend nunca é a fonte de verdade.
 */
export async function POST(request: Request) {
  if (!(await isMercadoPagoEnabled())) {
    return NextResponse.json({ error: "Mercado Pago não configurado" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { planId } = await request.json().catch(() => ({ planId: null }));

  const admin = createAdminClient();
  const profile = await getProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 400 });

  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  // Plano = oferta comercial (fonte de verdade). Sem planId, usa a oferta ativa.
  let plan: Plan | null = null;
  if (planId) {
    const { data: p } = await admin
      .from("plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .neq("status", "inactive")
      .maybeSingle();
    plan = (p as Plan | null) || null;
  }
  if (!plan) plan = await getActiveOffer();
  if (!plan) return NextResponse.json({ error: "Nenhuma oferta ativa disponível" }, { status: 400 });

  const preference = await createActivationPreference({
    tenantId: tenant.id,
    planId: plan.id,
    email: profile.email,
    name: profile.name,
    activationAmountCents: plan.activation_price_cents,
    planName: plan.name,
  });

  return NextResponse.json({
    url: preference.initPoint,
    sandbox: process.env.MERCADOPAGO_SANDBOX === "true",
  });
}