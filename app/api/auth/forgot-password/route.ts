import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPublicBaseUrl } from "@/lib/public-url";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!emailRaw || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verifica se e-mail existe em profiles (fonte do site). Também checa tenants por email se houver.
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("user_id, email")
    .ilike("email", emailRaw)
    .maybeSingle();

  if (profileErr) {
    console.error("forgot-password profile check error", profileErr.message);
  }

  // Fallback: lista usuários via auth admin se não encontrou em profiles (pode haver user sem profile ainda)
  let exists = !!profile;
  if (!exists) {
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      exists = (list?.users || []).some((u) => (u.email || "").toLowerCase() === emailRaw);
    } catch {}
  }

  if (!exists) {
    return NextResponse.json({ error: "E-mail não encontrado. Verifique ou crie uma conta." }, { status: 404 });
  }

  // Envia e-mail de recuperação. redirectTo deve estar em Supabase > Auth > URL Configuration
  const supabase = createClient();
  const redirectTo = `${getPublicBaseUrl()}/auth/callback?next=/atualizar-senha`;

  const { error } = await supabase.auth.resetPasswordForEmail(emailRaw, {
    redirectTo,
  });

  if (error) {
    // Supabase pode retornar rate limit ou outros erros
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: "Enviamos um e-mail com instruções para criar uma nova senha. Verifique sua caixa de entrada e spam." });
}
