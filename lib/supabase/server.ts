import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function createClient() {
  // Import dinâmico: "next/headers" só existe no servidor (Server Components,
  // Route Handlers). Import estático no topo quebra o build.
  // Sem cache global: o cookieStore deve ser novo a cada request.
  const headersModule = await import("next/headers");
  const cookieStore = headersModule.cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore!.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore!.set(name, value, options)
            );
          } catch {
            // Called from a Server Component. Safe to ignore when middleware is refreshing sessions.
          }
        },
      },
    }
  );
}