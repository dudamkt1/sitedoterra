import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { getActiveOffer, getPlanById } from "@/lib/commercial";
import type { Plan } from "@/types";
import { resolveGateways } from "@/lib/gateway-config";
import { processBrickPayment } from "@/lib/mercadopago";

const VISITOR_TOKEN_COOKIE = "tc_visitor_token";

export const runtime = "nodejs";

/**
 * POST /api/checkout/mp/process — processa o pagamento do Payment Brick
 * (cartão ou Pix) via Payments API, SEM redirect externo.
 *
 * O frontend envia o `formData` gerado pelo Brick (token do cartão,
 * payment_method_id, installments, payer). O VALOR é sempre recalculado aqui
 * a partir da oferta comercial (tabela plans) — nunca confia no cliente.
 *
 * A ativação continua acontecendo SOMENTE pelo webhook
 * (/api/webhooks/mercadopago), que usa o mesmo external_reference/metadata
 * da Preference. O frontend nunca é fonte de verdade.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const gateways = await resolveGateways();
  if (gateways.gateway !== "mercadopago" || !gateways.mercadopago.accessToken) {
    return NextResponse.json(
      { error: "Pagamento via Mercado Pago indisponível no momento." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const planId = typeof body.planId === "string" ? body.planId : undefined;
  const formData =
    body.formData && typeof body.formData === "object" ? body.formData : null;
  if (!formData) {
    return NextResponse.json({ error: "Dados do pagamento não recebidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const profile = await getProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 400 });

  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

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

  const cookieStore = await cookies();
  const visitorToken = cookieStore.get(VISITOR_TOKEN_COOKIE)?.value || null;

  const fullName = String((profile as { name?: unknown }).name || "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);

  try {
    const payment = await processBrickPayment({
      tenantId: tenant.id,
      planId: plan.id,
      email: profile.email,
      firstName: firstName || null,
      lastName: rest.length > 0 ? rest.join(" ") : null,
      activationAmountCents: plan.activation_price_cents,
      planName: plan.name,
      visitorToken,
      formData,
    });
    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail || null,
      payment_method_id: payment.payment_method_id || null,
      payment_type_id: payment.payment_type_id || null,
      point_of_interaction: payment.point_of_interaction || null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao processar pagamento.";
    const clean = message
      .replace(/Mercado Pago API[^\:]*:\s*/i, "")
      .replace(/\(.*\)/, "")
      .trim();
    return NextResponse.json(
      { error: clean.slice(0, 300) || "Erro ao processar pagamento." },
      { status: 502 }
    );
  }
}
