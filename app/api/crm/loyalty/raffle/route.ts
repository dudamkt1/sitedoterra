import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import {
  ensureCurrentRound,
  getDrawnRounds,
  getPendingCredits,
  getRaffleSettings,
  getRoundEntries,
  normalizeRaffleSettings,
} from "@/lib/crm-raffle";

export const runtime = "nodejs";

/** GET /api/crm/loyalty/raffle — config + rodada atual + pendentes + histórico. */
export async function GET() {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  try {
    const settings = await getRaffleSettings(admin, tenant!.id);
    const round = await ensureCurrentRound(admin, tenant!.id, settings);
    const [entries, credits, history] = await Promise.all([
      getRoundEntries(admin, tenant!.id, round.id),
      getPendingCredits(admin, tenant!.id),
      getDrawnRounds(admin, tenant!.id, 10),
    ]);
    const total = round.settings_snapshot.total_numbers;
    return NextResponse.json({
      settings,
      round: {
        ...round,
        filled_count: entries.length,
        missing_count: Math.max(0, total - entries.length),
      },
      entries,
      credits,
      history,
    });
  } catch (e) {
    // Banco sem a migration 0053: responde vazio em vez de quebrar o painel.
    if (/loyalty_raffle/i.test(e instanceof Error ? e.message : "")) {
      return NextResponse.json({ missingMigration: true, settings: null, round: null, entries: [], credits: [], history: [] });
    }
    return NextResponse.json({ error: "Erro ao carregar sorteio." }, { status: 500 });
  }
}

/** PUT /api/crm/loyalty/raffle — salva config (toggle + valores + prêmio). */
export async function PUT(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const current = await getRaffleSettings(admin, tenant!.id).catch(() => null);
  // O painel envia valores em REAIS (amount_reais, prize_credit_reais);
  // o banco guarda CENTAVOS (padrão do CRM). Também aceita centavos diretos.
  const amountCents =
    body.amount_reais !== undefined && body.amount_reais !== ""
      ? Math.round(Number(String(body.amount_reais).replace(",", ".")) * 100)
      : body.amount_per_number_cents !== undefined
        ? Math.round(Number(body.amount_per_number_cents) || 0)
        : current?.amount_per_number_cents;
  const creditCents =
    body.prize_credit_reais !== undefined && body.prize_credit_reais !== ""
      ? Math.round(Number(String(body.prize_credit_reais).replace(",", ".")) * 100)
      : body.prize_credit_amount_cents !== undefined
        ? body.prize_credit_amount_cents === null || body.prize_credit_amount_cents === ""
          ? null
          : Math.round(Number(body.prize_credit_amount_cents) || 0)
        : current?.prize_credit_amount_cents;
  const normalized = normalizeRaffleSettings(tenant!.id, {
    ...(current || {}),
    enabled: body.enabled !== undefined ? body.enabled === true : current?.enabled,
    amount_per_number_cents: amountCents,
    total_numbers: body.total_numbers !== undefined ? body.total_numbers : current?.total_numbers,
    prize_type: body.prize_type !== undefined ? body.prize_type : current?.prize_type,
    prize_description: body.prize_description !== undefined ? body.prize_description : current?.prize_description,
    prize_credit_amount_cents: creditCents,
  });
  // amount chega em centavos do painel; garante mínimo de R$ 1,00.
  if (normalized.amount_per_number_cents < 100) normalized.amount_per_number_cents = 100;

  const payload = {
    enabled: normalized.enabled,
    amount_per_number_cents: normalized.amount_per_number_cents,
    total_numbers: normalized.total_numbers,
    prize_type: normalized.prize_type,
    prize_description: normalized.prize_description,
    prize_credit_amount_cents: normalized.prize_credit_amount_cents,
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await admin
    .from("loyalty_raffle_settings")
    .select("tenant_id")
    .eq("tenant_id", tenant!.id)
    .maybeSingle();
  const err = existing
    ? (await admin.from("loyalty_raffle_settings").update(payload).eq("tenant_id", tenant!.id)).error
    : (await admin.from("loyalty_raffle_settings").insert({ tenant_id: tenant!.id, ...payload })).error;
  if (err) return NextResponse.json({ error: "Erro ao salvar sorteio." }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_raffle_settings_update",
    entity_type: "loyalty_raffle_settings",
    entity_id: tenant!.id,
    metadata: { enabled: payload.enabled },
  });
  return NextResponse.json({ success: true, settings: normalized });
}
