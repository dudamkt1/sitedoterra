import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOffer } from "@/lib/commercial";

export interface PublicAffiliateConfig {
  program_active: boolean;
  commission_percent: number;
  min_payout_amount: number;
  activation_price_cents: number;
}

/**
 * Config pública do Programa de Afiliados — FONTE ÚNICA para tudo que exibe
 * o percentual de comissão fora do painel (página /afiliados, calculadora,
 * chamada na home). O cálculo real da comissão usa a mesma tabela
 * (`affiliate_settings`, via getAffiliateSettings/lib + snapshot por venda).
 *
 * Fallbacks = defaults do seed (10%, R$50, R$297).
 */
export async function getPublicAffiliateConfig(): Promise<PublicAffiliateConfig> {
  let commissionPercent = 10;
  let minPayoutAmount = 50;
  let programActive = true;
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("get_affiliate_settings");
    const row = (Array.isArray(data) ? data[0] : data) as {
      commission_percent?: number;
      min_payout_amount?: number;
      program_active?: boolean;
    } | null;
    if (row) {
      if (Number.isFinite(Number(row.commission_percent))) {
        commissionPercent = Math.min(100, Math.max(0, Number(row.commission_percent)));
      }
      if (Number.isFinite(Number(row.min_payout_amount))) {
        minPayoutAmount = Math.max(0, Number(row.min_payout_amount));
      }
      if (typeof row.program_active === "boolean") programActive = row.program_active;
    }
  } catch {
    // mantém os defaults
  }

  let activationPriceCents = 29700;
  try {
    const offer = await getActiveOffer();
    if (offer && Number.isFinite(Number(offer.activation_price_cents))) {
      activationPriceCents = Math.round(Number(offer.activation_price_cents));
    }
  } catch {
    // mantém o default
  }

  return {
    program_active: programActive,
    commission_percent: commissionPercent,
    min_payout_amount: minPayoutAmount,
    activation_price_cents: activationPriceCents,
  };
}
