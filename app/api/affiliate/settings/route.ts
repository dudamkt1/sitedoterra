import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_affiliate_settings");

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return NextResponse.json({ success: false, error: "Configurações não encontradas" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: Array.isArray(data) ? data[0] : data });
}