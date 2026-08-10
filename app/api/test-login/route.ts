import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureSuperAdminRole } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * ACESSO RÁPIDO — TESTES
 *
 * Login server-side das contas de teste. As credenciais NUNCA chegam ao
 * frontend (ficam apenas em variáveis de ambiente no servidor).
 *
 * Só funciona quando ENABLE_TEST_ACCOUNTS=true (gate de autorização) e
 * NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS=true (gate de visibilidade dos botões).
 *
 * POST /api/test-login   body: { account: "superadmin" | "client" }
 */

const ACCOUNTS = {
  superadmin: {
    emailKey: "TEST_SUPERADMIN_EMAIL",
    passwordKey: "TEST_SUPERADMIN_PASSWORD",
    redirect: "/admin",
  },
  client: {
    emailKey: "TEST_USER_EMAIL",
    passwordKey: "TEST_USER_PASSWORD",
    redirect: "/painel",
  },
} as const;

export async function GET() {
  const enabled =
    process.env.ENABLE_TEST_ACCOUNTS === "true" &&
    process.env.NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS === "true";
  return NextResponse.json({ enabled });
}

export async function POST(request: Request) {
  const enabledServer = process.env.ENABLE_TEST_ACCOUNTS === "true";
  const enabledPublic = process.env.NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS === "true";

  if (!enabledServer || !enabledPublic) {
    return NextResponse.json(
      { error: "Acesso rápido de teste desativado no servidor." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const account = ACCOUNTS[String(body.account || "") as keyof typeof ACCOUNTS];
  if (!account) {
    return NextResponse.json({ error: "Conta de teste inválida." }, { status: 400 });
  }

  const email = process.env[account.emailKey];
  const password = process.env[account.passwordKey];

  if (
    !email ||
    !password ||
    password.length < 6 ||
    password.startsWith("change-me")
  ) {
    return NextResponse.json(
      { error: "Credenciais de teste não configuradas no servidor." },
      { status: 500 }
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    console.error("test-login falhou:", email, error.message);
    return NextResponse.json(
      { error: "Falha na autenticação da conta de teste." },
      { status: 401 }
    );
  }

  // Reforça a promoção de superadmin baseada em SUPER_ADMIN_EMAILS
  await ensureSuperAdminRole();

  return NextResponse.json({ success: true, redirect: account.redirect });
}
