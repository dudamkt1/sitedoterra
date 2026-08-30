import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/feedback/count
 * Retorna o número de mensagens com status=pending (badge da sidebar).
 * Apenas super admin.
 */
export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ unread: 0 }, { status: 200 });
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") {
    return NextResponse.json({ unread: 0 }, { status: 200 });
  }
  const admin = createAdminClient();
  const { count } = await admin
    .from("user_feedback")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return NextResponse.json({ unread: count || 0 });
}
