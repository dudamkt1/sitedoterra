import { NextResponse } from "next/server";
import { DEMO_COOKIE_NAME } from "@/lib/demo/auth";

export const runtime = "nodejs";

/**
 * POST /api/demo/exit
 * Encerra a sessão DEMO removendo o cookie httpOnly.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: DEMO_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
