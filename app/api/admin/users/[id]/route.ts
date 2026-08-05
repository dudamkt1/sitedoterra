import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Ações do Super Admin sobre um usuário: bloquear/desbloquear, suspender/reativar.
 * PATCH /api/admin/users/[id]  body: { action }
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

  const { action } = await request.json();
  const admin = createAdminClient();
  const userId = params.id;

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
