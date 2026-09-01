import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAffiliateSettings } from "@/lib/affiliate";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { visitor_token, new_customer_user_id, sale_amount_cents } = body;

    if (!visitor_token || !new_customer_user_id || !sale_amount_cents) {
      return NextResponse.json(
        { error: "Parâmetros obrigatórios: visitor_token, new_customer_user_id, sale_amount_cents" },
        { status: 400 }
      );
    }

    // Busca configuração do programa (para pegar % de comissão atual)
    const settings = await getAffiliateSettings();
    if (!settings?.program_active) {
      return NextResponse.json({ success: true, message: "Programa inativo" });
    }

    const commissionPercent = Number(settings.commission_percent) || 0;
    const saleAmount = sale_amount_cents / 100; // converte centavos para reais

    const admin = createAdminClient();

    // Registra a conversão via function SQL
    const { data: conversionId, error } = await admin.rpc("register_affiliate_conversion", {
      p_visitor_token: visitor_token,
      p_new_customer_user_id: new_customer_user_id,
      p_sale_amount: saleAmount,
      p_commission_percent: commissionPercent,
    });

    if (error) {
      console.error("Erro ao registrar conversão de afiliado:", error);
      return NextResponse.json({ error: "Erro ao registrar conversão" }, { status: 500 });
    }

    if (!conversionId) {
      return NextResponse.json({
        success: true,
        message: "Nenhuma atribuição pendente para este visitor_token",
      });
    }

    return NextResponse.json({
      success: true,
      conversion_id: conversionId,
    });
  } catch (err) {
    console.error("Erro no endpoint de conversão de afiliado:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}