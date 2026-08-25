import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getOrCreateCustomer, createRecurringSubscription } from "@/lib/billing";

export const runtime = "nodejs";

/** Senha forte o suficiente para o Supabase Aceitar (mínimo 6 caracteres). */
function validPassword(p: unknown): p is string {
  return typeof p === "string" && p.length >= 6 && p.length <= 72;
}

/**
 * Ações do Super Admin sobre um usuário: bloquear/desbloquear, suspender/reativar,
 * ATIVAR o site (com/sem mensalidade), editar dados completos (nome, telefone,
 * e-mail), redefinir senha, promover/rebaixar para super admin, controlar
 * isenção de mensalidade e status da assinatura.
 * PATCH /api/admin/users/[id]  body: { action, ... }
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

  // ---------------------------------------------------- editar perfil ----
  if (action === "update_profile") {
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name.trim() || null;
    if (typeof body.phone === "string") patch.phone = body.phone.trim() || null;
    if (patch.name === undefined && patch.phone === undefined && !body.email) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
    }
    if (Object.keys(patch).length > 0) {
      await admin.from("profiles").update(patch).eq("user_id", userId);
    }
    // Troca de e-mail: precisa atualizar também o auth.users.
    if (typeof body.email === "string" && body.email.includes("@")) {
      const email = body.email.trim().toLowerCase();
      const { data: current } = await admin.from("profiles").select("email").eq("user_id", userId).maybeSingle();
      if (current?.email !== email) {
        const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
          email,
          email_confirm: true,
        });
        if (authErr) {
          return NextResponse.json({ error: "E-mail inválido ou já em uso." }, { status: 400 });
        }
        await admin.from("profiles").update({ email }).eq("user_id", userId);
      }
    }
    await audit(admin, actor.id, "user.profile_updated", userId);
    return NextResponse.json({ success: true });
  }

  // ------------------------------------------------------ nova senha ----
  if (action === "set_password") {
    if (!validPassword(body.password)) {
      return NextResponse.json({ error: "A senha precisa ter ao menos 6 caracteres." }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(userId, { password: body.password });
    if (error) return NextResponse.json({ error: "Não foi possível redefinir a senha." }, { status: 400 });
    await audit(admin, actor.id, "user.password_reset", userId);
    return NextResponse.json({ success: true });
  }

  // ---------------------------------------------------------- papel -----
  if (action === "set_role") {
    const role = body.role === "superadmin" ? "superadmin" : "user";
    if (userId === actor.id && role !== "superadmin") {
      return NextResponse.json(
        { error: "Você não pode remover seu próprio acesso de super admin." },
        { status: 400 }
      );
    }
    await admin.from("profiles").update({ role }).eq("user_id", userId);
    await audit(admin, actor.id, role === "superadmin" ? "user.promoted_superadmin" : "user.demoted_user", userId, { role });
    return NextResponse.json({ success: true });
  }

  // --------------------------------------------- isenção de mensalidade -
  if (action === "toggle_monthly") {
    const enabled = Boolean(body.enabled);
    const { data: tenant } = await admin.from("tenants").select("id").eq("user_id", userId).maybeSingle();
    if (!tenant) return NextResponse.json({ error: "Usuário sem tenant" }, { status: 404 });
    await admin.from("tenants").update({ monthly_billing_enabled: enabled }).eq("id", tenant.id);
    await audit(admin, actor.id, enabled ? "tenant.monthly_enabled" : "tenant.monthly_exempted", userId, { enabled });
    return NextResponse.json({ success: true });
  }

  // ------------------------------------------- status da assinatura -----
  if (action === "set_subscription_status") {
    const allowedStatuses = ["awaiting_activation", "active", "paused", "canceled", "past_due"];
    const status = String(body.status || "");
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    const { data: tenant } = await admin.from("tenants").select("id").eq("user_id", userId).maybeSingle();
    if (!tenant) return NextResponse.json({ error: "Usuário sem tenant" }, { status: 404 });
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return NextResponse.json({ error: "Usuário sem assinatura." }, { status: 404 });
    await admin.from("subscriptions").update({
      status,
      canceled_at: status === "canceled" ? new Date().toISOString() : null,
    }).eq("id", sub.id);
    await audit(admin, actor.id, "subscription.status_changed", sub.id, { target_user_id: userId, status });
    return NextResponse.json({ success: true });
  }

  // ------------------------------------------------ ativação do site ----
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

  const allowed: Record<
    string,
    {
      profile?: Record<string, unknown>;
      tenant?: Record<string, unknown>;
      audit: string;
      /** Banimento real no Supabase Auth (impede login de verdade). */
      auth?: { ban_duration?: string };
    }
  > = {
    block: {
      profile: { status: "blocked", blocked_at: new Date().toISOString() },
      tenant: { site_status: "suspended", suspended_at: new Date().toISOString() },
      audit: "user.blocked",
      auth: { ban_duration: "876000h" }, // ~100 anos
    },
    unblock: {
      profile: { status: "active", blocked_at: null, unblocked_at: new Date().toISOString() },
      tenant: { site_status: "active", suspended_at: null },
      audit: "user.unblocked",
      auth: { ban_duration: "none" },
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

  if (cfg.auth) {
    // Best-effort: se o usuário não existir mais no auth, segue o fluxo.
    try {
      await admin.auth.admin.updateUserById(userId, cfg.auth);
    } catch {}
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

/** Registra ação do super admin na trilha de auditoria. */
async function audit(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  action: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {}
) {
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    actor_role: "superadmin",
    action,
    entity_type: "profile",
    entity_id: entityId,
    metadata: { ...metadata },
  });
}

/**
 * Exclui PERMANENTEMENTE o usuário (auth.users) — perfil, site, assinatura,
 * CRM e mídias são removidos em cascata pelo banco.
 * Proteções: não pode excluir a si mesmo nem outro super admin.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const userId = params.id;
  if (userId === actor.id) {
    return NextResponse.json({ error: "Você não pode excluir sua própria conta." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("email, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  if ((target as { role?: string }).role === "superadmin") {
    return NextResponse.json(
      { error: "Remova o papel de Super Admin antes de excluir este usuário." },
      { status: 400 }
    );
  }

  // Remove dados do app primeiro (evita corrida com triggers), depois o auth.
  const { data: tenant } = await admin.from("tenants").select("id").eq("user_id", userId).maybeSingle();
  if (tenant) {
    for (const table of ["site_settings", "pwa_settings", "tenant_sections"]) {
      await admin.from(table).delete().eq("tenant_id", (tenant as { id: string }).id);
    }
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível excluir a conta. Verifique vínculos pendentes." },
      { status: 400 }
    );
  }

  await audit(admin, actor.id, "user.deleted", null, {
    target_user_id: userId,
    email: (target as { email?: string }).email,
  });

  return NextResponse.json({ success: true });
}
