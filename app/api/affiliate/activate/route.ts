import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("affiliate_status")
    .upsert(
      {
        user_id: user.id,
        is_active: true,
        accepted_terms_at: new Date().toISOString(),
        accepted_terms_version: 1,
      },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}