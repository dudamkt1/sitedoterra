import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Super Admin actions for users.
 * POST /api/admin/users  body: { action, ... }
 *
 * action: "create-user"  -> body: { name, email, password, role }
 * action: "create-credit" -> body: { userId, amount, kind }
 *
 * O trigger on_auth_user_created cria automaticamente profile + tenant + site_settings.
 */
export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json();
  const action = body?.action || "";

  // --- Criação de usuário ---
  if (action === "create-user") {
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = body.role === "superadmin" ? "superadmin" : "user";

    if (!name) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "A senha precisa ter ao menos 6 caracteres." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error || !created?.user) {
      const msg =
        error?.message?.includes("already") || error?.message?.includes("registered")
          ? "Já existe uma conta com este e-mail."
          : "Não foi possível criar a conta.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // O trigger cria o profile com role padrão; aplica o papel escolhido.
    await admin.from("profiles").update({ role }).eq("user_id", created.user.id);

    await admin.from("audit_logs").insert({
      actor_id: actor.id,
      actor_role: "superadmin",
      action: "user.created",
      entity_type: "profile",
      entity_id: created.user.id,
      metadata: { target_user_id: created.user.id, email, role },
    });

    return NextResponse.json({ success: true, userId: created.user.id });
  }

  // --- Criação de crédito ---
  if (action === "create-credit") {
    const { userId, amount, kind } = body || {};

    if (!userId) return NextResponse.json({ error: "ID do usuário não informado." }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });
    if (kind !== "activation" && kind !== "subscription") {
      return NextResponse.json({ error: "Tipo de crédito inválido. Use 'activation' ou 'subscription'." }, { status: 400 });
    }

    // Verifica se o usuário existe
    const admin = createAdminClient();
    const { data: user } = await admin.from("profiles").select("user_id, role").eq("user_id", userId).maybeSingle();
    if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

    // Reserva o crédito no sistema de affiliate credit
    const { data: usage, error: usageError } = await admin.rpc("reserve_affiliate_credit", {
      p_user_id: userId,
      p_amount: amount,
      p_tenant_id: null,
      p_kind: kind,
      p_metadata: JSON.stringify({ created_by_superadmin: true, source: "admin_panel" }),
    });

    if (usageError) return NextResponse.json({ error: usageError.message }, { status: 400 });

    return NextResponse.json({ success: true, usageId: usage.id, amount, kind });
  }

  // Action não reconhecido
  return NextResponse.json({ error: "Ação não reconhecida." }, { status: 400 });
}