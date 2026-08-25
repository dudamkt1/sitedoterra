import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Super Admin cria um novo usuário completo.
 * POST /api/admin/users  body: { name, email, password, role }
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
