import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { ensureCurrentRound, getRaffleSettings } from "@/lib/crm-raffle";

export const runtime = "nodejs";

/**
 * POST /api/crm/loyalty/raffle/entries
 * A consultora atribui um número da rodada atual a um cliente que tenha
 * crédito pendente (gerado por compra confirmada). { client_id, chosen_number }
 */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const chosen = Math.floor(Number(body.chosen_number) || 0);
  if (!clientId) return NextResponse.json({ error: "Cliente não informado." }, { status: 400 });
  if (!Number.isInteger(chosen) || chosen < 1) {
    return NextResponse.json({ error: "Número inválido." }, { status: 400 });
  }

  const settings = await getRaffleSettings(admin, tenant!.id);
  if (!settings.enabled) return NextResponse.json({ error: "Sorteio desativado." }, { status: 400 });
  const round = await ensureCurrentRound(admin, tenant!.id, settings);
  const total = round.settings_snapshot.total_numbers;
  if (chosen < 1 || chosen > total) {
    return NextResponse.json({ error: `Número deve estar entre 1 e ${total}.` }, { status: 400 });
  }

  const { data: client } = await admin
    .from("crm_clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("tenant_id", tenant!.id)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 400 });

  // Crédito pendente (um número por vez; consome o mais antigo primeiro).
  const { data: credits } = await admin
    .from("loyalty_raffle_credits")
    .select("*")
    .eq("tenant_id", tenant!.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  const usable = ((credits as { id: string; sale_id: string; numbers_total: number; numbers_used: number }[]) || []).find(
    (c) => c.numbers_total - c.numbers_used > 0
  );
  if (!usable) {
    return NextResponse.json({ error: "Cliente sem crédito de número pendente." }, { status: 400 });
  }

  const { data: entry, error: entryErr } = await admin
    .from("loyalty_raffle_entries")
    .insert({
      round_id: round.id,
      tenant_id: tenant!.id,
      client_id: clientId,
      chosen_number: chosen,
      earned_from_sale_id: usable.sale_id,
    })
    .select()
    .single();
  if (entryErr) {
    if (/duplicate|unique/i.test(entryErr.message || "")) {
      return NextResponse.json({ error: `Número ${chosen} já foi escolhido nesta rodada.` }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao registrar número." }, { status: 500 });
  }

  await admin
    .from("loyalty_raffle_credits")
    .update({ numbers_used: usable.numbers_used + 1 })
    .eq("id", usable.id);
  await admin.from("crm_client_timeline").insert({
    tenant_id: tenant!.id,
    client_id: clientId,
    event_type: "beneficio",
    title: `🎟️ Número da sorte ${chosen} garantido!`,
    description: "Sorteio por fidelidade",
    event_at: new Date().toISOString(),
  });
  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_raffle_entry_create",
    entity_type: "loyalty_raffle_entries",
    entity_id: entry.id,
    metadata: { client_id: clientId, chosen_number: chosen, round_id: round.id },
  });
  return NextResponse.json({ success: true, entry });
}
