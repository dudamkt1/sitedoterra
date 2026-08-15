import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getOrCreateCustomer, createRecurringSubscription } from "@/lib/billing";

export const runtime = "nodejs";

/**
 * Ações do Super Admin sobre um usuário: bloquear/desbloquear, suspender/reativar
 * e ATIVAR o site com ou sem mensalidade recorrente.
 * PATCH /api/admin/users/[id]  body: { action, billing? }
 *
 * activate_site:
 *   - billing "monthly": site ativo COM mensalidade (cria recorrência no Stripe se possível).
 *   - billing "none": site ativo SEM mensalidade (isenção — o usuário não será cobrado).
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;
  const admin = createAdminClient();
  const userId = params.id;

  if (action === "activate_site") {
    const billing: "monthly" | "none" = body.billing === "none" ? "none" : "monthly";

    const { data: tenant } = await admin
      .from("tenants")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!tenant) return NextResponse.json({ error: "Usuário sem tenant" }, { status: 404 });

    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const now = new Date().toISOString();
    await admin.from("profiles").update({
      status: "active",
      activated_at: now,
      suspended_at: null,
      blocked_at: null,
      unblocked_at: null,
      cancelled_at: null,
    }).eq("user_id", userId);

    await admin.from("tenants").update({
      site_status: "active",
      monthly_billing_enabled: billing === "monthly",
      activated_at: now,
      suspended_at: null,
      cancelled_at: null,
      reactivated_at: billing === "monthly" ? null : now,
    }).eq("id", tenant.id);

    // Assinatura local: garante um registro ativo (sem recorrência obrigatória).
    const { data: existingSub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const subBase = {
      tenant_id: tenant.id,
      status: "active",
      cancel_at_period_end: false,
      activated_at: now,
      canceled_at: null,
    };

    let subId = existingSub?.id || null;
    if (subId) {
      await admin.from("subscriptions").update(subBase).eq("id", subId);
    } else {
      const { data: created } = await admin
        .from("subscriptions")
        .insert({
          plan_id: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          stripe_price_id: null,
          ...subBase,
        })
        .select("id")
        .single();
      subId = created?.id || null;
    }

    // Com mensalidade: tenta criar a recorrência real no Stripe (best-effort).
    // Sem customer/pagamento válido, o site ainda fica ativo; a recorrência
    // poderá ser criada pelo usuário em /painel/assinatura.
    if (billing === "monthly" && profile?.email) {
      try {
        const customer = await getOrCreateCustomer({
          userId,
          tenantId: tenant.id,
          email: profile.email,
          name: profile.name,
        });
        const stripeSub = await createRecurringSubscription(customer.id, {
          userId,
          tenantId: tenant.id,
          email: profile.email,
          name: profile.name,
        });
        const stripePayload = {
          status: "active",
          stripe_customer_id: customer.id,
          stripe_subscription_id: stripeSub.id,
          stripe_price_id: (stripeSub.items.data[0]?.price?.id as string) || null,
          cancel_at_period_end: false,
          current_period_start: stripeSub.current_period_start ? new Date(stripeSub.current_period_start * 1000).toISOString() : null,
          current_period_end: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
          next_billing_at: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
          activated_at: now,
        };
        if (subId) {
          await admin.from("subscriptions").update(stripePayload).eq("id", subId);
        } else {
          await admin.from("subscriptions").insert({ tenant_id: tenant.id, ...stripePayload });
        }
      } catch (e) {
        console.warn("activate_site: recorrência Stripe não criada (sem pagamento configurado).", e);
      }
    }

    await admin.from("audit_logs").insert({
      actor_id: actor.id,
      actor_role: "superadmin",
      action: billing === "monthly" ? "user.site_activated_billing" : "user.site_activated_no_billing",
      entity_type: "profile",
      entity_id: userId,
      metadata: { target_user_id: userId, billing, monthly_billing_enabled: billing === "monthly" },
    });

    return NextResponse.json({ success: true });
  }

  const allowed: Record<string, { profile?: Record<string, unknown>; tenant?: Record<string, unknown>; audit: string }> = {
    block: {
      profile: { status: "blocked", blocked_at: new Date().toISOString() },
      tenant: { site_status: "suspended", suspended_at: new Date().toISOString() },
      audit: "user.blocked",
    },
    unblock: {
      profile: { status: "active", blocked_at: null, unblocked_at: new Date().toISOString() },
      tenant: { site_status: "active", suspended_at: null },
      audit: "user.unblocked",
    },
    suspend: {
      profile: { status: "suspended", suspended_at: new Date().toISOString() },
      tenant: { site_status: "suspended", suspended_at: new Date().toISOString() },
      audit: "user.suspended",
    },
    unsuspend: {
      profile: { status: "active", suspended_at: null },
      tenant: { site_status: "active", suspended_at: null },
      audit: "user.unsuspended",
    },
  };

  const cfg = allowed[action];
  if (!cfg) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  const { data: tenant } = await admin.from("tenants").select("id").eq("user_id", userId).maybeSingle();

  if (cfg.profile) {
    await admin.from("profiles").update(cfg.profile).eq("user_id", userId);
  }
  if (cfg.tenant && tenant) {
    await admin.from("tenants").update(cfg.tenant).eq("id", tenant.id);
  }

  await admin.from("audit_logs").insert({
    actor_id: actor.id,
    actor_role: "superadmin",
    action: cfg.audit,
    entity_type: "profile",
    entity_id: userId,
    metadata: { target_user_id: userId },
  });

  return NextResponse.json({ success: true });
}
