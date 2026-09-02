import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const [balanceRes, pendingRes, paidRes, clicksRes, conversionsRes] = await Promise.all([
    admin.rpc("get_affiliate_balance", { p_user_id: user.id }),
    admin.rpc("get_affiliate_pending_balance", { p_user_id: user.id }),
    admin
      .from("affiliate_payouts")
      .select("amount")
      .eq("affiliate_user_id", user.id)
      .eq("status", "pago"),
    admin
      .from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_user_id", user.id),
    admin
      .from("affiliate_conversions")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_user_id", user.id),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      total_clicks: clicksRes.count || 0,
      total_conversions: conversionsRes.count || 0,
      available_balance: Number(balanceRes.data || 0),
      pending_balance: Number(pendingRes.data || 0),
      total_paid: paidRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    },
  });
}