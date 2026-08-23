import { NextResponse } from "next/server";
import {
  createDemoCookieValue,
  DEMO_COOKIE_MAX_AGE,
  DEMO_COOKIE_NAME,
} from "@/lib/demo/auth";

export const runtime = "nodejs";

/**
 * POST /api/demo/start
 * Cria o cookie HMAC httpOnly que identifica uma sessão DEMO e redireciona
 * para /painel. NUNCA toca Supabase/R2/Stripe.
 */
export async function POST() {
  const { value } = await createDemoCookieValue();
  const res = NextResponse.json({ ok: true, redirect: "/painel" });
  res.cookies.set({
    name: DEMO_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_COOKIE_MAX_AGE,
  });
  return res;
}

export async function GET() {
  return POST();
}
