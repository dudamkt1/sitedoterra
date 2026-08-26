import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  // Support legacy without action: infer
  const admin = createAdminClient();
  const profile = await getProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  // ----- trocar senha -----
  if (action === "change_password" || (body.password && !body.name && !body.email && body.phone === undefined && !body.newPassword)) {
    // allow body.password or body.newPassword
    const newPass = String(body.newPassword || body.password || "");
    if (newPass.length < 6 || newPass.length > 72) {
      return NextResponse.json({ error: "A senha precisa ter entre 6 e 72 caracteres." }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPass });
    if (error) {
      return NextResponse.json({ error: "Não foi possível alterar a senha." }, { status: 400 });
    }
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_role: (profile.role as string) || "user",
      action: "user.password_changed_self",
      entity_type: "profile",
      entity_id: user.id,
      metadata: {},
    });
    return NextResponse.json({ success: true });
  }

  if (action === "change_password_all") {
    // not used
  }

  // ----- atualizar perfil -----
  // action === "update_profile" or no action with name/email/phone
  if (action === "update_profile" || action === "" || body.name !== undefined || body.email !== undefined || body.phone !== undefined) {
    // If action is change_password we already returned; otherwise treat as profile update
    if (action === "change_password") {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    let emailToUpdate: string | null = null;

    if (body.name !== undefined) {
      const name = String(body.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
      }
      if (name.length < 2) {
        return NextResponse.json({ error: "Nome muito curto." }, { status: 400 });
      }
      patch.name = name;
    }

    if (body.phone !== undefined) {
      const phone = String(body.phone || "").trim();
      // allow empty to clear
      patch.phone = phone || null;
    }

    if (body.email !== undefined) {
      const raw = String(body.email || "").trim().toLowerCase();
      if (!isValidEmail(raw)) {
        return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
      }
      if (raw !== profile.email.toLowerCase()) {
        emailToUpdate = raw;
      }
    }

    // If also has password in same request, treat as combined (optional)
    const newPass = body.newPassword || body.password;
    let passwordToUpdate: string | null = null;
    if (newPass !== undefined && action !== "update_profile") {
      // already handled
    }
    // Allow simultaneous password change via same call if action is update_profile and password provided
    if (typeof newPass === "string" && newPass.length > 0 && action === "update_profile") {
      if (newPass.length < 6 || newPass.length > 72) {
        return NextResponse.json({ error: "A nova senha precisa ter entre 6 e 72 caracteres." }, { status: 400 });
      }
      passwordToUpdate = newPass;
    }

    if (Object.keys(patch).length === 0 && !emailToUpdate && !passwordToUpdate) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from("profiles").update(patch).eq("user_id", user.id);
      if (error) {
        return NextResponse.json({ error: "Não foi possível atualizar os dados." }, { status: 500 });
      }
    }

    if (emailToUpdate) {
      const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
        email: emailToUpdate,
        email_confirm: true,
      });
      if (authErr) {
        const msg = authErr.message?.toLowerCase().includes("already") || authErr.message?.toLowerCase().includes("exists")
          ? "Este e-mail já está em uso."
          : "E-mail inválido ou já em uso.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      await admin.from("profiles").update({ email: emailToUpdate }).eq("user_id", user.id);
    }

    if (passwordToUpdate) {
      const { error } = await admin.auth.admin.updateUserById(user.id, { password: passwordToUpdate });
      if (error) {
        return NextResponse.json({ error: "Dados salvos, mas não foi possível alterar a senha." }, { status: 400 });
      }
    }

    // touch updated_at if needed
    // audit
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_role: (profile.role as string) || "user",
      action: "user.profile_updated_self",
      entity_type: "profile",
      entity_id: user.id,
      metadata: { fields: Object.keys(patch), emailChanged: !!emailToUpdate },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const supabase = createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
  return NextResponse.json({ profile });
}
