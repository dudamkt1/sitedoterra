import { NextResponse } from "next/server";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getAiUsageStats } from "@/lib/ai-center";

export const runtime = "nodejs";

/** GET /api/admin/ai/stats — estatísticas de uso da Central de IA (Super Admin). */
export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const stats = await getAiUsageStats();
  return NextResponse.json({ stats });
}