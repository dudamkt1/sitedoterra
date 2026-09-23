import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicTenantBySlug } from "@/lib/tenant";
import {
  ensureCurrentRound,
  getDrawnRounds,
  getRaffleSettings,
  getRoundEntries,
} from "@/lib/crm-raffle";
import { firstNameOf } from "@/lib/loyalty-raffle";

export const runtime = "nodejs";

/**
 * GET /api/raffle/public?slug=afiliado1
 * Dados públicos do sorteio (grade de números com primeiro nome, prêmio,
 * progresso e últimos ganhadores com nome completo). Sem dados sensíveis.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ error: "Slug não informado." }, { status: 400 });
  try {
    const tenant = await getPublicTenantBySlug(slug);
    if (!tenant) return NextResponse.json({ error: "Site não encontrado." }, { status: 404 });
    const admin = createAdminClient();
    const settings = await getRaffleSettings(admin, tenant.tenant_id);
    if (!settings.enabled) return NextResponse.json({ enabled: false });
    const round = await ensureCurrentRound(admin, tenant.tenant_id, settings);
    const [entries, history] = await Promise.all([
      getRoundEntries(admin, tenant.tenant_id, round.id),
      getDrawnRounds(admin, tenant.tenant_id, 5),
    ]);
    const total = round.settings_snapshot.total_numbers;
    return NextResponse.json({
      enabled: true,
      amount_per_number_cents: round.settings_snapshot.amount_per_number_cents,
      total_numbers: total,
      prize_type: round.settings_snapshot.prize_type,
      prize_description: round.settings_snapshot.prize_description,
      prize_credit_amount_cents: round.settings_snapshot.prize_credit_amount_cents,
      filled_count: entries.length,
      missing_count: Math.max(0, total - entries.length),
      numbers: entries.map((e) => ({
        number: e.chosen_number,
        name: firstNameOf(e.client_name || ""),
      })),
      winners: history.map((h) => ({
        name: h.winner_name,
        number: h.winner_number,
        prize: h.settings_snapshot.prize_description,
        prize_type: h.settings_snapshot.prize_type,
        drawn_at: h.drawn_at,
        seed: h.random_seed,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Sorteio indisponível." }, { status: 500 });
  }
}
