import { createServerClient, type CookieOptions } from "@supabase/ssr";

let cookieStore: any | null = null;

async function ensureCookieStore() {
  if (!cookieStore) {
    const module = await import("next/headers");
    cookieStore = module.cookies();
  }
  return cookieStore;
}

export async function createClient() {
  const cookieStore = await ensureCookieStore();

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