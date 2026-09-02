import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const { method, amount, pix_key } = body;

  if (!method || !amount || amount <= 0) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  if (method === "pix" && !pix_key) {
    return NextResponse.json({ error: "Chave PIX é obrigatória" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verifica saldo disponível
  const { data: balanceData } = await admin.rpc("get_affiliate_balance", { p_user_id: user.id });
  const availableBalance = Number(balanceData || 0);
  if (amount > availableBalance) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // Verifica mínimo
  const { data: settingsData } = await admin.rpc("get_affiliate_settings");
  const settings = Array.isArray(settingsData) ? settingsData[0] : settingsData;
  const minPayout = Number(settings?.min_payout_amount || 50);
  if (amount < minPayout) {
    return NextResponse.json({ error: `Valor mínimo para saque: R$ ${minPayout.toFixed(2)}` }, { status: 400 });
  }

  const { error } = await admin.from("affiliate_payouts").insert({
    affiliate_user_id: user.id,
    amount,
    method,
    pix_key: method === "pix" ? pix_key : null,
    status: "solicitado",
  });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}