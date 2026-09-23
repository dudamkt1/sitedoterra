import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { DEMO_COOKIE_NAME } from "@/lib/demo/auth";

/**
 * POST /auth/signout
 * Encerra a sessão e redireciona de volta para a página de origem
 * (ex.: /afiliado1) quando seguro — nunca "expulsa" o visitante do
 * site do usuário para o domínio principal.
 *
 * IMPORTANTE: os cookies de sessão são aplicados NA PRÓPRIA RESPONSE de
 * redirect — se usássemos cookies() + NextResponse.redirect padrão, o
 * Set-Cookie poderia não chegar ao browser e o usuário continuaria "logado"
 * até um refresh manual.
 */
export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}

/**
 * GET /auth/signout
 * Mesmo comportamento, para links simples (ex.: aviso de sessão nos
 * sites públicos). Aceita `?next=/slug` explícito e, na ausência dele,
 * usa o Referer same-origin como fallback.
 */
export async function GET(request: NextRequest) {
  return signOutAndRedirect(request);
}

/**
 * Valida um destino pós-logout contra open-redirect:
 * - aceita apenas path relativo same-origin (`/afiliado1`, `/?a=b`, etc.)
 * - rejeita `//evil.com`, `\\/`, `http:`, `javascript:`, backslash, etc.
 */
function sanitizeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // mantém o valor bruto se não for um encoding válido
  }
  if (!decoded.startsWith("/")) return null;
  if (decoded.startsWith("//")) return null;
  if (decoded.includes("\\")) return null;
  const lower = decoded.toLowerCase();
  if (
    lower.startsWith("/\\") ||
    lower.includes("javascript:") ||
    lower.includes("data:") ||
    lower.includes("http:") ||
    lower.includes("https:")
  ) {
    return null;
  }
  // Limita tamanho para evitar header abusivo
  if (decoded.length > 2048) return null;
  return decoded;
}

/**
 * Rotas internas onde permanecer logado-deslogado não faz sentido:
 * após sair do /painel, /admin ou /login, o fallback correto é a
 * HOME pública — nunca voltar para dentro do painel.
 */
function isInternalAuthPath(pathname: string): boolean {
  return (
    pathname === "/painel" ||
    pathname.startsWith("/painel/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/login" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/")
  );
}

function resolvePostSignOutTarget(request: NextRequest): string {
  const homeBase =
    process.env.NEXT_PUBLIC_HOME_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const homeOrigin = new URL(homeBase).origin;

  // 1) Parâmetro explícito tem prioridade: /auth/signout?next=/afiliado1
  const explicit = sanitizeNextPath(
    request.nextUrl.searchParams.get("next") ||
      request.nextUrl.searchParams.get("returnTo") ||
      request.nextUrl.searchParams.get("redirect")
  );
  if (explicit) return new URL(explicit, homeOrigin).toString();

  // 2) Fallback: Referer same-origin (cobre links antigos sem ?next=).
  //    Mantém o visitante no site do usuário (/afiliado1) em vez de
  //    jogá-lo para o domínio principal.
  try {
    const referer =
      request.headers.get("referer") || headers().get("referer");
    if (referer) {
      const refUrl = new URL(referer);
      const requestOrigin = request.nextUrl.origin;
      const sameOrigin =
        refUrl.origin === requestOrigin || refUrl.origin === homeOrigin;
      if (sameOrigin && !isInternalAuthPath(refUrl.pathname)) {
        const safePath = sanitizeNextPath(
          `${refUrl.pathname}${refUrl.search}${refUrl.hash}`
        );
        if (safePath) return new URL(safePath, homeOrigin).toString();
      }
    }
  } catch {
    // ignora Referer inválido e cai no fallback da HOME
  }

  // 3) Fallback final: HOME pública canônica.
  return new URL("/", homeBase).toString();
}

async function signOutAndRedirect(request: NextRequest) {
  const cookieStore = cookies();
  // Destino pós-logout: volta para a página de origem (ex.: /afiliado1)
  // quando seguro; só cai para a HOME canônica como último recurso.
  const target = resolvePostSignOutTarget(request);
  let response = NextResponse.redirect(target);

  // Higiene: encerra também uma sessão de demonstração ativa.
  response.cookies.set({
    name: DEMO_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

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