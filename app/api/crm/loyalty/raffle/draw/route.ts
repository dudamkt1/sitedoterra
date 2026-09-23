import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { performDraw } from "@/lib/crm-raffle";

export const runtime = "nodejs";

/**
 * POST /api/crm/loyalty/raffle/draw
 * Sorteia AGORA entre os números preenchidos (pode antecipar sem completar
 * a meta) e abre automaticamente a próxima rodada.
 */
export async function POST() {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  try {
    const result = await performDraw(admin, tenant!.id, user!.id);
    return NextResponse.json({
      success: true,
      winner_number: result.winnerNumber,
      winner_name: result.winnerName,
      round_id: result.round.id,
      next_round_id: result.nextRound.id,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao realizar sorteio." },
      { status: 400 }
    );
  }
}
