import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * POST /auth/signout
 * Encerra a sessão e redireciona para a HOME ("/").
 *
 * IMPORTANTE: os cookies de sessão são aplicados NA PRÓPRIA RESPONSE de
 * redirect — se usássemos cookies() + NextResponse.redirect padrão, o
 * Set-Cookie poderia não chegar ao browser e o usuário continuaria "logado"
 * até um refresh manual.
 */
export async function POST() {
  return signOutAndRedirect();
}

/**
 * GET /auth/signout
 * Mesmo comportamento, para links simples (ex.: aviso de sessão na HOME).
 */
export async function GET() {
  return signOutAndRedirect();
}

async function signOutAndRedirect() {
  const cookieStore = cookies();
  const home = new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  let response = NextResponse.redirect(home);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.signOut();
  return response;
}