import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import {
  buildPayoutSnapshot,
  getAffiliatePaymentMethod,
} from "@/lib/affiliate";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const { amount } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // ============================================================
  // REGRA CRÍTICA: o afiliado DEVE ter dados de recebimento
  // cadastrados antes de poder solicitar um saque. Sem isso, não é
  // possível pagar a comissão.
  // ============================================================
  const paymentMethod = await getAffiliatePaymentMethod(user.id);
  if (!paymentMethod) {
    return NextResponse.json(
      {
        error:
          "Cadastre seus dados de recebimento antes de solicitar um saque.",
      },
      { status: 400 }
    );
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

  // Snapshot dos dados de pagamento ATUAIS — preserva o histórico
  // mesmo se o afiliado alterar sua chave PIX/e-mail depois.
  const snapshot = await buildPayoutSnapshot(user.id);

  const { error } = await admin.from("affiliate_payouts").insert({
    affiliate_user_id: user.id,
    amount,
    method: paymentMethod.method,
    // Campos legados (mantidos para retrocompatibilidade)
    pix_key: paymentMethod.method === "pix" ? paymentMethod.pix_key : null,
    mercado_pago_account_info:
      paymentMethod.method === "mercado_pago" ? { email: paymentMethod.mp_email } : null,
    // Snapshot (fonte da verdade para pagamentos)
    pix_key_type_snapshot: snapshot.pix_key_type_snapshot,
    pix_key_snapshot: snapshot.pix_key_snapshot,
    mp_email_snapshot: snapshot.mp_email_snapshot,
    payment_method_label: snapshot.payment_method_label,
    status: "solicitado",
  });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}