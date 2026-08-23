import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/painel", "/admin"];
const AUTH_PREFIXES = ["/login", "/cadastro", "/signup"];

const DEMO_COOKIE_NAME = "sitedoterra_demo";

function getDemoSecret(): string {
  return (
    process.env.DEMO_SECRET ||
    process.env.TEST_USER_PASSWORD ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "sitedoterra-demo-fallback-secret"
  );
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(new Uint8Array(sig));
}

async function isDemoCookieValid(raw: string | undefined | null): Promise<boolean> {
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  const [nonce, startedAt, sig] = parts;
  if (!nonce || !startedAt || !sig) return false;
  const expected = await hmacHex(getDemoSecret(), `${nonce}.${startedAt}`);
  return timingSafeEqual(sig, expected);
}

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

  // ---- Identidade DEMO ----
  // O cookie DEMO é independente do Supabase Auth: permite acesso a /painel
  // SEM usuário real, mas é estritamente bloqueado em /admin/* e em APIs.
  const demoCookie = request.cookies.get(DEMO_COOKIE_NAME)?.value;
  const isDemo = await isDemoCookieValid(demoCookie);

  // Bloqueio absoluto: usuários em modo DEMO nunca acessam /admin
  if (isDemo && pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    url.searchParams.set("demo_blocked", "1");
    return NextResponse.redirect(url);
  }

  // Bloqueio absoluto: APIs reais nunca executam em modo DEMO.
  // Exceção: rotas /api/demo/* (start, exit, reset) que são o próprio
  // mecanismo de gestão da sessão de demonstração.
  if (isDemo && pathname.startsWith("/api/") && !pathname.startsWith("/api/demo/")) {
    return new NextResponse(
      JSON.stringify({
        error:
          "Operação bloqueada: ambiente de demonstração. Suas alterações ficam somente neste dispositivo.",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (needsAuth && !user && !isDemo) {
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
