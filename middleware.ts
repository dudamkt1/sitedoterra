import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/painel", "/admin"];
const AUTH_PREFIXES = ["/login", "/cadastro", "/signup"];

const MAIN_HOST = (process.env.NEXT_PUBLIC_APP_URL || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

function isCustomDomain(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (!h) return false;
  if (h === "localhost" || h.startsWith("localhost:")) return false;
  if (h.endsWith(".vercel.app")) return false;
  if (MAIN_HOST && h === MAIN_HOST.replace(/^www\./, "")) return false;
  return true;
}

async function resolveSlugByHostname(host: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const domain = host.toLowerCase().replace(/^www\./, "").split(":")[0];
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_public_tenant_by_domain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ p_domain: domain }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row as { slug?: string } | null)?.slug || null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  try {
    return await handleMiddleware(request);
  } catch {
    return NextResponse.next({ request });
  }
}

async function handleMiddleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("host") || request.headers.get("x-forwarded-host") || "";

  // ---- Resolução de domínio personalizado ----
  if (isCustomDomain(host)) {
    // Página para domínio ainda não conectado (não reescrever para rotas internas)
    if (!pathname || pathname === "/" || pathname === "/index.html") {
      const slug = await resolveSlugByHostname(host);
      if (slug) {
        const url = request.nextUrl.clone();
        url.pathname = `/${slug}`;
        return NextResponse.rewrite(url);
      }
      const url = request.nextUrl.clone();
      url.pathname = "/site-indisponivel";
      return NextResponse.rewrite(url);
    }
  }

  // ---- Auth ----
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PREFIXES.some((p) => pathname.startsWith(p));

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
