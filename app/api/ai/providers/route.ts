import { NextResponse } from "next/server";
import { getEnabledProviders } from "@/lib/ai";

export const runtime = "nodejs";

/** GET /api/ai/providers — lista provedores habilitados (informação pública). */
export async function GET() {
  const providers = await getEnabledProviders();
  return NextResponse.json({ providers });
}
