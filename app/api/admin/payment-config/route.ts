import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import {
  resolveGateways,
  type Gateway,
} from "@/lib/gateway-config";
import { getStripeResolved } from "@/lib/stripe";
import { ensureStripePricesForPlan, getMonthlyPrice } from "@/lib/billing";
import { getActiveOffer } from "@/lib/commercial";

export const runtime = "nodejs";

/**
 * Configuração de PAGAMENTOS (Super Admin → /admin/pagamentos).
 *
 * GET   → estado atual (segredos mascarados) + política do plano ativo
 * PUT   → salva gateway/chaves/sandbox e (opcional) política comercial
 * POST  → { action: "test", gateway } testa a conexão com o gateway
 *
 * Isolamento: apenas superadmin. Segredos nunca são retornados por inteiro.
 */

async function requireSuperAdmin() {
  const actor = await getCurrentUser();
  if (!actor) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }
  return { actor };
}

function mask(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v.length <= 8) return "••••";
  return `••••${v.slice(-4)}`;
}

async function activePlan(admin: ReturnType<typeof createAdminClient>) {
  const plan = await getActiveOffer();
  void admin;
  return plan;
}

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const resolved = await resolveGateways();
  const admin = createAdminClient();
  const plan = await activePlan(admin);

  return NextResponse.json({
    gateway: resolved.gateway,
    stripe: {
      secret_mask: mask(resolved.stripe.secretKey),
      webhook_mask: mask(resolved.stripe.webhookSecret),
      publishable_key: resolved.stripe.publishableKey || "",
      has_secret: Boolean(resolved.stripe.secretKey),
      has_webhook: Boolean(resolved.stripe.webhookSecret),
    },
    mercadopago: {
      token_mask: mask(resolved.mercadopago.accessToken),
      webhook_mask: mask(resolved.mercadopago.webhookSecret),
      sandbox: resolved.mercadopago.sandbox,
      has_token: Boolean(resolved.mercadopago.accessToken),
    },
    policy: plan
      ? {
          plan_id: plan.id,
          name: plan.name,
          activation_price_cents: plan.activation_price_cents,
          monthly_price_cents: plan.monthly_price_cents,
          trial_months: plan.trial_months,
          allow_cancel: plan.allow_cancel,
        }
      : null,
  });
}

export async function PUT(request: Request) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  // ---------- singleton payment_config ----------
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.gateway === "stripe" || body.gateway === "mercadopago") {
    updates.gateway = body.gateway as Gateway;
  }

  // Chaves: string vazia/ausente = mantém a atual; null explícito limpa.
  const setIfProvided = (field: string, key: string) => {
    if (typeof body[key] === "string" && body[key].trim() !== "") {
      updates[field] = body[key].trim();
    }
  };
  setIfProvided("stripe_secret_key", "stripe_secret_key");
  setIfProvided("stripe_publishable_key", "stripe_publishable_key");
  setIfProvided("stripe_webhook_secret", "stripe_webhook_secret");
  setIfProvided("mercadopago_access_token", "mercadopago_access_token");
  setIfProvided("mercadopago_webhook_secret", "mercadopago_webhook_secret");

  if (typeof body.mercadopago_sandbox === "boolean") {
    updates.mercadopago_sandbox = body.mercadopago_sandbox;
  }

  const { error } = await admin
    .from("payment_config")
    .upsert({ id: 1, ...updates }, { onConflict: "id" });
  if (error) {
    console.error("[payment-config] upsert:", error.message);
    return NextResponse.json({ error: "Erro ao salvar configuração." }, { status: 500 });
  }

  // ---------- política comercial do plano ATIVO ----------
  let policySaved = false;
  const plan = await activePlan(admin);
  if (plan && body.policy && typeof body.policy === "object") {
    const p = body.policy;
    const int = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
    const planUpdate: Record<string, unknown> = {};
    if (p.activation_price_cents !== undefined)
      planUpdate.activation_price_cents = int(p.activation_price_cents);
    if (p.monthly_price_cents !== undefined)
      planUpdate.monthly_price_cents = int(p.monthly_price_cents);
    if (p.trial_months !== undefined) planUpdate.trial_months = Math.max(1, int(p.trial_months));
    if (typeof p.allow_cancel === "boolean") planUpdate.allow_cancel = p.allow_cancel;

    if (Object.keys(planUpdate).length > 0) {
      const { error: planErr } = await admin
        .from("plans")
        .update(planUpdate)
        .eq("id", plan.id);
      if (planErr) {
        return NextResponse.json(
          { error: "Configuração salva, mas falha ao atualizar o plano ativo." },
          { status: 500 }
        );
      }
      policySaved = true;
    }
  }

  // ---------- Stripe: garante Price IDs com os valores configurados ----------
  let stripePricesNote: string | null = null;
  const finalGateway = (await resolveGateways()).gateway;
  if (finalGateway === "stripe" && plan && (body.policy || body.ensure_stripe_prices)) {
    try {
      const res = await ensureStripePricesForPlan(plan.id);
      stripePricesNote = res.created
        ? "Price IDs do Stripe criados/atualizados com os valores configurados."
        : null;
    } catch (e) {
      stripePricesNote = `Aviso: não foi possível criar os Price IDs no Stripe (${
        e instanceof Error ? e.message : "erro desconhecido"
      }).`;
    }
  }

  await admin.from("audit_logs").insert({
    actor_id: guard.actor!.id,
    actor_role: "superadmin",
    action: "payment_config.updated",
    entity_type: "payment_config",
    entity_id: "1",
    metadata: { gateway: updates.gateway ?? undefined, policySaved },
  });

  return NextResponse.json({ success: true, policySaved, stripePricesNote });
}

export async function POST(request: Request) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => ({}));
  const target: Gateway = body.gateway === "mercadopago" ? "mercadopago" : "stripe";
  const resolved = await resolveGateways();

  try {
    if (target === "stripe") {
      if (!resolved.stripe.secretKey) {
        return NextResponse.json({ ok: false, message: "Nenhuma Secret Key configurada." });
      }
      const stripe = await getStripeResolved();
      const account = await stripe.accounts.retrieve();
      await getMonthlyPrice().catch(() => null);
      return NextResponse.json({
        ok: true,
        message: `Conectado ao Stripe — conta ${account.business_profile?.name || account.id || "OK"}.`,
      });
    }

    if (!resolved.mercadopago.accessToken) {
      return NextResponse.json({ ok: false, message: "Nenhum Access Token configurado." });
    }
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${resolved.mercadopago.accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        message: `Mercado Pago rejeitou o token (${res.status}).`,
      });
    }
    const me = (await res.json()) as { nickname?: string; email?: string };
    return NextResponse.json({
      ok: true,
      message: `Conectado ao Mercado Pago — ${me.nickname || me.email || "conta OK"}${
        resolved.mercadopago.sandbox ? " (SANDBOX)" : ""
      }.`,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      message: e instanceof Error ? e.message : "Falha na conexão.",
    });
  }
}
