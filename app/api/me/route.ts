import { NextResponse } from "next/server";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 200 });
  const profile = await getProfile(user.id);
  return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email }, profile });
}
