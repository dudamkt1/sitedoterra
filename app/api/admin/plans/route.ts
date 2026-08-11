import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Cria/atualiza planos e a configuração comercial (Super Admin).
 * POST /api/admin/plans
 *
 * - Preços, mensalidade, benefícios, textos e Price IDs do Stripe são
 *   gerenciados aqui (fonte de verdade central).
 * - Toda alteração de preço é registrada em `price_history` (auditoria).
 * - Quando STRIPE_SECRET_KEY está configurada, valida se o valor dos Price
 *   IDs cadastrados corresponde ao valor configurado (consistência).
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

  if (body.id) {
    // ---------- Histórico de preços (auditoria) ----------
    const { data: previous } = await admin
      .from("plans")
      .select(
        "activation_regular_price_cents, activation_price_cents, monthly_price_cents, status"
      )
      .eq("id", body.id)
      .maybeSingle();
    if (previous) {
      const priceFields: { field: string; prev: number; next: number }[] = [
        { field: "activation_regular_price_cents", prev: previous.activation_regular_price_cents || 0, next: payload.activation_regular_price_cents as number },
        { field: "activation_price_cents", prev: previous.activation_price_cents || 0, next: payload.activation_price_cents as number },
        { field: "monthly_price_cents", prev: previous.monthly_price_cents || 0, next: payload.monthly_price_cents as number },
      ];
      for (const p of priceFields) {
        if (p.prev !== p.next) {
          await admin.from("price_history").insert({
            plan_id: body.id,
            field: p.field,
            previous_value_cents: p.prev,
            new_value_cents: p.next,
            changed_by: actor.id,
          });
        }
      }
    }

    const { error } = await admin.from("plans").update(payload).eq("id", body.id);
    if (error) return NextResponse.json({ error: "Erro ao atualizar oferta" }, { status: 500 });
  } else {
    const { data: created, error } = await admin
      .from("plans")
      .insert(payload)
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: "Erro ao criar oferta" }, { status: 500 });
    body.id = created.id;
  }

  await admin.from("audit_logs").insert({
    actor_id: actor.id,
    actor_role: "superadmin",
    action: "commercial.offer_updated",
    entity_type: "plan",
    entity_id: body.id || body.code,
    metadata: { ...payload },
  });

  // ---------- Consistência com o Stripe (soft warning, não bloqueia) ----------
  const warnings: string[] = [];
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      const stripe = getStripe();
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
  }

  return NextResponse.json({ success: true, warnings });
}
