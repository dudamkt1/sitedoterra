import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";

export async function PATCH(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json();
  const { commission_percent, min_payout_amount, program_active, cookie_max_age_days } = body;

  const admin = createAdminClient();
  const { error } = await admin
    .from("affiliate_settings")
    .update({
      commission_percent,
      min_payout_amount,
      program_active,
      cookie_max_age_days,
    })
    .eq("id", (await admin.from("affiliate_settings").select("id").limit(1).single()).data?.id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}