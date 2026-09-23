import { createAdminClient } from "@/lib/supabase/admin";
import {
  RAFFLE_ALGORITHM,
  clampAmountCents,
  clampTotalNumbers,
  drawWinnerIndex,
  generateSeed,
  numbersForPurchase,
} from "@/lib/loyalty-raffle";
import type {
  LoyaltyRaffleCredit,
  LoyaltyRaffleEntry,
  LoyaltyRafflePrizeType,
  LoyaltyRaffleRound,
  LoyaltyRaffleSettings,
} from "@/types";

type AdminClient = ReturnType<typeof createAdminClient>;

const DEFAULTS: Omit<LoyaltyRaffleSettings, "tenant_id"> = {
  enabled: false,
  amount_per_number_cents: 5000,
  total_numbers: 30,
  prize_type: "brinde",
  prize_description: "",
  prize_credit_amount_cents: null,
};

export function normalizeRaffleSettings(
  tenantId: string,
  data: Record<string, unknown> | null
): LoyaltyRaffleSettings {
  const prizeType = String(data?.prize_type || "brinde");
  return {
    tenant_id: tenantId,
    enabled: data?.enabled === true,
    amount_per_number_cents: clampAmountCents(data?.amount_per_number_cents, DEFAULTS.amount_per_number_cents),
    total_numbers: clampTotalNumbers(data?.total_numbers ?? DEFAULTS.total_numbers),
    prize_type: (["brinde", "dinheiro", "credito_loja"].includes(prizeType) ? prizeType : "brinde") as LoyaltyRafflePrizeType,
    prize_description: String(data?.prize_description || "").slice(0, 500),
    prize_credit_amount_cents:
      data?.prize_credit_amount_cents == null || data.prize_credit_amount_cents === ""
        ? null
        : Math.max(1, Math.round(Number(data.prize_credit_amount_cents) || 0)),
  };
}

export async function getRaffleSettings(admin: AdminClient, tenantId: string): Promise<LoyaltyRaffleSettings> {
  const { data } = await admin.from("loyalty_raffle_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  return normalizeRaffleSettings(tenantId, (data as Record<string, unknown> | null) || null);
}

/**
 * Estado da seção "Sorteio Fidelidade" na home do tenant.
 * Sem override próprio, vale o global (sites não-congelados); sites já
 * congelados sem override nem enxergam a seção.
 */
export async function getRaffleSectionState(
  admin: AdminClient,
  tenantId: string
): Promise<{ section_id: string | null; global_enabled: boolean; section_enabled: boolean }> {
  const { data: section } = await admin
    .from("site_sections")
    .select("id, enabled")
    .eq("type", "loyalty_raffle")
    .maybeSingle();
  if (!section) return { section_id: null, global_enabled: false, section_enabled: false };
  const { data: override } = await admin
    .from("tenant_sections")
    .select("enabled")
    .eq("tenant_id", tenantId)
    .eq("section_id", (section as { id: string }).id)
    .maybeSingle();
  const globalEnabled = (section as { enabled: boolean }).enabled !== false;
  return {
    section_id: (section as { id: string }).id,
    global_enabled: globalEnabled,
    section_enabled: override ? (override as { enabled: boolean }).enabled !== false : globalEnabled,
  };
}

/**
 * Ao ATIVAR o sorteio, liga também a seção na home do tenant — sem isso a
 * seção ficava "ativa mas invisível" (o componente público só renderiza com
 * o sorteio ligado, e a seção precisa estar ligada para o componente
 * existir). Preserva conteúdo/settings já personalizados. Ao desativar o
 * sorteio, a seção é mantida como está (o componente some sozinho).
 */
export async function ensureRaffleSectionEnabled(admin: AdminClient, tenantId: string): Promise<boolean> {
  const state = await getRaffleSectionState(admin, tenantId);
  if (!state.section_id || state.section_enabled) return state.section_enabled;
  const { data: existing } = await admin
    .from("tenant_sections")
    .select("content, settings")
    .eq("tenant_id", tenantId)
    .eq("section_id", state.section_id)
    .maybeSingle();
  const { error } = await admin.from("tenant_sections").upsert(
    {
      tenant_id: tenantId,
      section_id: state.section_id,
      enabled: true,
      content: (existing as { content?: Record<string, unknown> } | null)?.content || {},
      settings: (existing as { settings?: Record<string, unknown> } | null)?.settings || {},
    },
    { onConflict: "tenant_id,section_id" }
  );
  if (error) return false;
  return true;
}

function snapshotOf(s: LoyaltyRaffleSettings): LoyaltyRaffleRound["settings_snapshot"] {
  return {
    amount_per_number_cents: s.amount_per_number_cents,
    total_numbers: s.total_numbers,
    prize_type: s.prize_type,
    prize_description: s.prize_description,
    prize_credit_amount_cents: s.prize_credit_amount_cents,
  };
}

/** Rodada aberta atual; cria uma (com snapshot da config vigente) se não existir. */
export async function ensureCurrentRound(
  admin: AdminClient,
  tenantId: string,
  settings?: LoyaltyRaffleSettings
): Promise<LoyaltyRaffleRound> {
  const s = settings || (await getRaffleSettings(admin, tenantId));
  const { data: open } = await admin
    .from("loyalty_raffle_rounds")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "collecting")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open) return open as LoyaltyRaffleRound;
  const { data: created, error } = await admin
    .from("loyalty_raffle_rounds")
    .insert({ tenant_id: tenantId, settings_snapshot: snapshotOf(s), status: "collecting" })
    .select()
    .single();
  if (error || !created) throw new Error("Erro ao abrir rodada do sorteio.");
  return created as LoyaltyRaffleRound;
}

export async function getRoundEntries(
  admin: AdminClient,
  tenantId: string,
  roundId: string
): Promise<LoyaltyRaffleEntry[]> {
  const { data: entries } = await admin
    .from("loyalty_raffle_entries")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("round_id", roundId)
    .order("chosen_number", { ascending: true });
  const rows = (entries as LoyaltyRaffleEntry[]) || [];
  if (rows.length === 0) return rows;
  const { data: clients } = await admin
    .from("crm_clients")
    .select("id, name")
    .in("id", Array.from(new Set(rows.map((e) => e.client_id))))
    .eq("tenant_id", tenantId);
  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));
  return rows.map((e) => ({ ...e, client_name: nameById.get(e.client_id) || null }));
}

export async function getPendingCredits(
  admin: AdminClient,
  tenantId: string
): Promise<LoyaltyRaffleCredit[]> {
  const { data: credits } = await admin
    .from("loyalty_raffle_credits")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = ((credits as LoyaltyRaffleCredit[]) || []).filter(
    (c) => c.numbers_total - c.numbers_used > 0
  );
  if (rows.length === 0) return rows;
  const { data: clients } = await admin
    .from("crm_clients")
    .select("id, name")
    .in("id", Array.from(new Set(rows.map((c) => c.client_id))))
    .eq("tenant_id", tenantId);
  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));
  return rows.map((c) => ({
    ...c,
    client_name: nameById.get(c.client_id) || null,
    numbers_pending: c.numbers_total - c.numbers_used,
  }));
}

/**
 * Gatilho chamado ao confirmar compra (status Pago/Parcial).
 * Idempotente por venda (upsert por sale_id). Não cria sistema de vendas
 * paralelo: só deriva créditos da venda existente.
 */
export async function grantRaffleCredits(
  admin: AdminClient,
  tenantId: string,
  clientId: string,
  saleId: string,
  totalCents: number
): Promise<{ granted: number }> {
  const settings = await getRaffleSettings(admin, tenantId);
  if (!settings.enabled) return { granted: 0 };
  const numbers = numbersForPurchase(totalCents, settings.amount_per_number_cents);
  if (numbers <= 0) return { granted: 0 };
  const { error } = await admin.from("loyalty_raffle_credits").upsert(
    {
      tenant_id: tenantId,
      client_id: clientId,
      sale_id: saleId,
      numbers_total: numbers,
    },
    { onConflict: "sale_id", ignoreDuplicates: false }
  );
  if (error) throw new Error("Erro ao gerar números da sorte.");
  // Upsert por sale_id: re-confirmações da mesma venda ajustam o total sem
  // zerar numbers_used já consumidos (coluna não enviada = preservada).
  await admin.from("crm_client_timeline").insert({
    tenant_id: tenantId,
    client_id: clientId,
    event_type: "beneficio",
    title: `+${numbers} número(s) da sorte`,
    description: "Sorteio por fidelidade — escolha o número com a consultora",
    event_at: new Date().toISOString(),
  });
  return { granted: numbers };
}

/**
 * Variante para vendas criadas fora do POST manual (catálogo/PIX/webhook):
 * carrega a venda pelo id e concede créditos se confirmada (Pago/Parcial).
 * Acessório: nunca lança (não pode quebrar webhooks de pagamento).
 */
export async function grantRaffleCreditsForSale(admin: AdminClient, saleId: string): Promise<void> {
  try {
    const { data: sale } = await admin
      .from("crm_sales")
      .select("tenant_id, client_id, status, total_cents")
      .eq("id", saleId)
      .maybeSingle();
    if (!sale?.client_id) return;
    if (sale.status !== "Pago" && sale.status !== "Parcial") return;
    await grantRaffleCredits(admin, sale.tenant_id, sale.client_id, saleId, sale.total_cents);
  } catch {
    // sorteio acessório — ignora
  }
}

/** Histórico de rodadas já sorteadas (com nome do vencedor). */export async function getDrawnRounds(
  admin: AdminClient,
  tenantId: string,
  limit = 10
): Promise<(LoyaltyRaffleRound & { winner_name: string | null; winner_number: number | null })[]> {
  const { data: rounds } = await admin
    .from("loyalty_raffle_rounds")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "drawn")
    .order("drawn_at", { ascending: false })
    .limit(limit);
  const rows = (rounds as LoyaltyRaffleRound[]) || [];
  if (rows.length === 0) return [];
  const entryIds = rows.map((r) => r.winner_entry_id).filter(Boolean) as string[];
  const { data: entries } = entryIds.length
    ? await admin.from("loyalty_raffle_entries").select("id, client_id, chosen_number").in("id", entryIds)
    : { data: [] };
  const entryById = new Map(((entries as LoyaltyRaffleEntry[]) || []).map((e) => [e.id, e]));
  const clientIds = Array.from(new Set(Array.from(entryById.values()).map((e) => e.client_id)));
  const { data: clients } = clientIds.length
    ? await admin.from("crm_clients").select("id, name").in("id", clientIds).eq("tenant_id", tenantId)
    : { data: [] };
  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));
  return rows.map((r) => {
    const w = r.winner_entry_id ? entryById.get(r.winner_entry_id) : undefined;
    return {
      ...r,
      winner_name: w ? nameById.get(w.client_id) || null : null,
      winner_number: w ? w.chosen_number : null,
    };
  });
}

/**
 * Realiza o sorteio da rodada aberta entre os números preenchidos e abre
 * automaticamente a próxima rodada `collecting` (config vigente).
 */
export async function performDraw(
  admin: AdminClient,
  tenantId: string,
  actorId: string
): Promise<{ round: LoyaltyRaffleRound; winnerNumber: number; winnerName: string | null; nextRound: LoyaltyRaffleRound }> {
  const settings = await getRaffleSettings(admin, tenantId);
  const round = await ensureCurrentRound(admin, tenantId, settings);
  const entries = await getRoundEntries(admin, tenantId, round.id);
  if (entries.length === 0) throw new Error("Nenhum número escolhido nesta rodada.");
  const sorted = [...entries].sort((a, b) => a.chosen_number - b.chosen_number);
  const seed = generateSeed();
  const winner = sorted[drawWinnerIndex(seed, sorted.length)];
  const drawnAt = new Date().toISOString();

  const { data: closed, error } = await admin
    .from("loyalty_raffle_rounds")
    .update({
      status: "drawn",
      winner_entry_id: winner.id,
      drawn_at: drawnAt,
      random_seed: seed,
      algorithm_description: RAFFLE_ALGORITHM,
    })
    .eq("id", round.id)
    .eq("status", "collecting")
    .select()
    .single();
  if (error || !closed) throw new Error("Rodada já sorteada — recarregue a página.");

  // Próxima rodada começa sozinha com a configuração ATUAL.
  const fresh = await getRaffleSettings(admin, tenantId);
  const nextRound = await ensureCurrentRound(admin, tenantId, fresh);

  await admin.from("crm_client_timeline").insert({
    tenant_id: tenantId,
    client_id: winner.client_id,
    event_type: "beneficio",
    title: `🏆 Ganhou o sorteio com o número ${winner.chosen_number}!`,
    description: fresh.prize_description || "Sorteio por fidelidade",
    event_at: drawnAt,
  });
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    actor_role: "user",
    action: "crm_raffle_draw",
    entity_type: "loyalty_raffle_rounds",
    entity_id: round.id,
    metadata: {
      winner_entry_id: winner.id,
      winner_number: winner.chosen_number,
      filled: sorted.length,
      seed,
      drawn_at: drawnAt,
    },
  });
  return { round: closed as LoyaltyRaffleRound, winnerNumber: winner.chosen_number, winnerName: winner.client_name || null, nextRound };
}
