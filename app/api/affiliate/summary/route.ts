import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: balanceData }, { data: pendingData }, { data: paidData }, { data: clicksData }, { data: conversionsData }] = await Promise.all([
    admin.rpc("get_affiliate_balance", { p_user_id: user.id }),
    admin.rpc("get_affiliate_pending_balance", { p_user_id: user.id }),
    admin
      .from("affiliate_payouts")
      .select("amount")
      .eq("affiliate_user_id", user.id)
      .eq("status", "pago"),
    admin
      .from("affiliate_clicks")
      .select("id", { count: "exact" })
      .eq("affiliate_user_id", user.id),
    admin
      .from("affiliate_conversions")
      .select("id", { count: "exact" })
      .eq("affiliate_user_id", user.id),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      total_clicks: clicksData?.count || 0,
      total_conversions: conversionsData?.count || 0,
      available_balance: Number(balanceData || 0),
      pending_balance: Number(pendingData || 0),
      total_paid: paidData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    },
  });
}