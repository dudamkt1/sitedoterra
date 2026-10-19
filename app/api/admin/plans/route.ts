import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { resolveGateways } from "@/lib/gateway-config";
import { invalidateActiveOfferCache } from "@/lib/home";

export const runtime = "nodejs";

/**
 * Cria/atualiza planos e a configuração comercial (Super Admin).
 * POST /api/admin/plans
 *
 * - Preços, mensalidade, benefícios e textos são gerenciados aqui (fonte de
 *   verdade central).
 * - Toda alteração de preço é registrada em `price_history` (auditoria).
 * - Valida a consistência apenas do GATEWAY ATIVO: Stripe (Price IDs) ou
 *   Mercado Pago (mensalidade > 0). Campos do gateway inativo são legado.
 * - Ao mudar a mensalidade com Mercado Pago ativo, invalida o cache do plano
 *   recorrente para que um novo plano MP seja criado com o valor novo.
 */
export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json();
  const admin = createAdminClient();
  const gateways = await resolveGateways();
  const activeGateway = gateways.gateway;
  // Ids "local-*" só existiam no estado otimista de versões antigas do
  // formulário. Nunca são UUIDs: tratá-los como criação evita perder a edição.
  const existingId =
    typeof body.id === "string" && body.id && !body.id.startsWith("local-") ? body.id : null;

  const int = (v: unknown, fallback = 0) => Math.max(0, Math.round(Number(v) || fallback));
  const text = (v: unknown) => (v === undefined || v === null || v === "" ? null : String(v));
  const features = Array.isArray(body.features)
    ? (body.features as unknown[]).map((f) => (typeof f === "string" ? f : String(f)))
    : [];

  const payload: Record<string, unknown> = {
    name: body.name ? String(body.name) : "Oferta",
    code: body.code ? String(body.code) : `oferta-${Date.now().toString(36)}`,
    description: text(body.description),
    activation_regular_price_cents: int(body.activation_regular_price_cents),
    activation_price_cents: int(body.activation_price_cents),
    monthly_price_cents: int(body.monthly_price_cents),
    billing_interval: body.billing_interval === "year" ? "year" : "month",
    offer_title: text(body.offer_title),
    offer_subtitle: text(body.offer_subtitle),
    promo_text: text(body.promo_text),
    cta_text: text(body.cta_text),
    transparency_text: text(body.transparency_text),
    cancel_text: text(body.cancel_text),
    allow_cancel: body.allow_cancel !== false,
    trial_days: Math.max(1, Math.round(Number(body.trial_days) || 30)),
    trial_months: Math.max(1, Math.round(Number(body.trial_months) || 3)),
    media_quota_bytes: Math.max(1, Math.round(Number(body.media_quota_bytes) || 500 * 1024 * 1024)),
    sort_order: Math.round(Number(body.sort_order) || 0),
    features,
    stripe_product_id: text(body.stripe_product_id),
    activation_price_id: text(body.activation_price_id),
    monthly_price_id: text(body.monthly_price_id),
    is_active: Boolean(body.is_active),
  };

  // ---------- Mercado Pago: plano recorrente em cache ----------
  // O plano recorrente no MP é criado automaticamente no primeiro checkout.
  // Quando a mensalidade muda, invalidamos o cache para que `ensureRecurringPlan`
  // crie um novo plano com o valor novo (as assinaturas existentes mantêm o
  // preço contratado — o snapshot fica no próprio MP).
  let mpPlanReset = false;
  let previous: Record<string, unknown> | null = null;

  if (existingId) {
    // ---------- Estado anterior (histórico + consistência) ----------
    const { data } = await admin
      .from("plans")
      .select(
        "activation_regular_price_cents, activation_price_cents, monthly_price_cents, mercadopago_plan_id, mercadopago_plan_amount_cents, status"
      )
      .eq("id", existingId)
      .maybeSingle();
    previous = (data as Record<string, unknown> | null) || null;

    if (previous) {
      const priceFields: { field: string; prev: number; next: number }[] = [
        { field: "activation_regular_price_cents", prev: Number(previous.activation_regular_price_cents) || 0, next: payload.activation_regular_price_cents as number },
        { field: "activation_price_cents", prev: Number(previous.activation_price_cents) || 0, next: payload.activation_price_cents as number },
        { field: "monthly_price_cents", prev: Number(previous.monthly_price_cents) || 0, next: payload.monthly_price_cents as number },
      ];
      for (const p of priceFields) {
        if (p.prev !== p.next) {
          await admin.from("price_history").insert({
            plan_id: existingId,
            field: p.field,
            previous_value_cents: p.prev,
            new_value_cents: p.next,
            changed_by: actor.id,
          });
        }
      }

      if (
        activeGateway === "mercadopago" &&
        (Number(previous.monthly_price_cents) || 0) !== (payload.monthly_price_cents as number)
      ) {
        payload.mercadopago_plan_id = null;
        payload.mercadopago_plan_amount_cents = null;
        mpPlanReset = true;
      }
    }
  }

  let savedPlan: Record<string, unknown> | null = null;

  if (existingId) {
    const { data, error } = await admin
      .from("plans")
      .update(payload)
      .eq("id", existingId)
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[admin/plans] update:", error.message);
      return NextResponse.json({ error: "Erro ao atualizar oferta" }, { status: 500 });
    }
    savedPlan = (data as Record<string, unknown> | null) || null;
  } else {
    const { data, error } = await admin
      .from("plans")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[admin/plans] insert:", error.message);
      return NextResponse.json({ error: "Erro ao criar oferta" }, { status: 500 });
    }
    savedPlan = data as Record<string, unknown>;
    body.id = data.id;
  }

  await admin.from("audit_logs").insert({
    actor_id: actor.id,
    actor_role: "superadmin",
    action: "commercial.offer_updated",
    entity_type: "plan",
    entity_id: body.id || body.code,
    metadata: { ...payload },
  });

  // A HOME mantém um cache curto da oferta ativa. Invalida para que a
  // alteração apareça imediatamente (e não "volte" ao valor antigo).
  invalidateActiveOfferCache();
  revalidatePath("/");
  revalidatePath("/admin/planos");
  revalidatePath("/admin/pagamentos");

  // ---------- Consistência do gateway ATIVO (soft warning, não bloqueia) ----------
  const warnings: string[] = [];
  if (activeGateway === "stripe" && gateways.stripe.secretKey) {
    try {
      const { getStripeResolved } = await import("@/lib/stripe");
      const stripe = await getStripeResolved();
      const checks: { label: string; priceId: string; expected: number }[] = [];
      if (payload.activation_price_id) {
        checks.push({
          label: "Ativação",
          priceId: payload.activation_price_id as string,
          expected: payload.activation_price_cents as number,
        });
      }
      if (payload.monthly_price_id) {
        checks.push({
          label: "Mensalidade",
          priceId: payload.monthly_price_id as string,
          expected: payload.monthly_price_cents as number,
        });
      }
      for (const c of checks) {
        const price = await stripe.prices.retrieve(c.priceId);
        const amount = price.unit_amount || 0;
        if (amount !== c.expected) {
          warnings.push(
            `⚠️ ${c.label}: o Price "${c.priceId}" cobra ${(amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} e o valor configurado é ${(c.expected / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Para o checkout e a HOME exibirem valores idênticos, use um Price do Stripe com o mesmo valor ou crie um novo Price.`
          );
        }
      }
    } catch {
      warnings.push("Não foi possível validar os Price IDs no Stripe.");
    }
  } else if (activeGateway === "mercadopago" && (payload.monthly_price_cents as number) <= 0) {
    warnings.push("⚠️ Mercado Pago: a mensalidade está zerada. Configure um valor para criar a assinatura recorrente.");
  }

  return NextResponse.json({ success: true, gateway: activeGateway, plan: savedPlan, warnings, mpPlanReset });
}
