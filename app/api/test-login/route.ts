import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureSuperAdminRole } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * ACESSO RÁPIDO — TESTES
 *
 * Login server-side da conta única de teste (contato@keroimpresso.com.br).
 * As credenciais NUNCA chegam ao frontend (ficam apenas em variáveis de
 * ambiente no servidor).
 *
 * O botão fica sempre visível na tela /login; o login só é efetivado quando
 * as credenciais (TEST_USER_EMAIL / TEST_USER_PASSWORD) estão configuradas.
 *
 * POST /api/test-login
 */

const ACCOUNTS = {
  superadmin: {
    emailKey: "TEST_USER_EMAIL",
    passwordKey: "TEST_USER_PASSWORD",
    redirect: "/admin",
  },
} as const;

export async function GET() {
  return NextResponse.json({ enabled: true });
}

export async function POST(request: Request) {
  await request.json().catch(() => ({}));
  const account = ACCOUNTS.superadmin;

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
