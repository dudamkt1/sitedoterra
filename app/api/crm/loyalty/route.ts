import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { getLoyaltySettings, normalizeLoyaltyLevel, normalizeRedeemable } from "@/lib/crm";
import { sortedLevels } from "@/lib/crm-loyalty";

export const runtime = "nodejs";

/** GET /api/crm/loyalty — configurações + clientes com saldo, nível e estatísticas. */
export async function GET() {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const settings = await getLoyaltySettings(admin, tenant!.id);

  const [{ data: clients }, { data: points }] = await Promise.all([
    admin.from("crm_clients").select("id, name, category, is_vip").eq("tenant_id", tenant!.id).limit(2000),
    admin.from("crm_loyalty_points").select("client_id, amount").eq("tenant_id", tenant!.id).limit(5000),
  ]);
  const balance = new Map<string, number>();
  for (const p of points || []) balance.set(p.client_id, (balance.get(p.client_id) || 0) + (p.amount || 0));

  const levels = sortedLevels(settings.levels);
  const levelOf = (pts: number) => {
    let name = levels[0]?.name || "Bronze";
    for (const l of levels) if (pts >= (l.min_points || 0)) name = l.name;
    return name;
  };
  const clientRows = (clients || [])
    .map((c) => {
      const pts = balance.get(c.id) || 0;
      return { id: c.id, name: c.name, category: c.category, is_vip: c.is_vip, points: pts, level: levelOf(pts) };
    })
    .sort((a, b) => b.points - a.points);

  // Estatísticas do programa (dashboard).
  const perLevel = levels.map((l) => ({ name: l.name, min_points: l.min_points || 0, count: 0 }));
  let distributed = 0;
  for (const p of points || []) distributed += (p.amount || 0);
  for (const row of clientRows) {
    const idx = perLevel.findIndex((l) => l.name === row.level);
    if (idx >= 0) perLevel[idx].count += 1;
  }
  const stats = {
    participants: clientRows.filter((r) => r.points > 0).length,
    totalClients: clientRows.length,
    distributed,
    unlocked: perLevel.length > 1 ? clientRows.filter((r) => r.level !== perLevel[0].name).length : 0,
    perLevel,
  };

  return NextResponse.json({ settings, clients: clientRows, stats });
}

/** PUT /api/crm/loyalty — salva configurações do programa. */
export async function PUT(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const { data } = await admin.from("crm_loyalty_settings").select("tenant_id").eq("tenant_id", tenant!.id).maybeSingle();

  // Níveis estendidos (nome, pontos, benefícios, recompensas, desconto,
  // brindes, condições) — normalizados para o formato canônico.
  const levels = Array.isArray(body.levels) && body.levels.length
    ? (body.levels as unknown[]).slice(0, 20).map((l) => normalizeLoyaltyLevel(l))
    : [];

  // Catálogo de resgatáveis (estrutura preparada para resgate futuro).
  const redeemables = Array.isArray(body.redeemables)
    ? (body.redeemables as unknown[]).slice(0, 50).map((r) => normalizeRedeemable(r))
    : [];

  const payload: Record<string, unknown> = {
    enabled: body.enabled !== false,
    program_name: body.program_name || "Programa de Fidelidade",
    points_per_purchase_cents: Math.max(0, Math.round(Number(body.points_per_purchase_cents) || 0)),
    points_per_referral: Math.max(0, Math.round(Number(body.points_per_referral) || 0)),
    points_per_birthday: Math.max(0, Math.round(Number(body.points_per_birthday) || 0)),
    points_per_special: Math.max(0, Math.round(Number(body.points_per_special) || 0)),
    rules: Array.isArray(body.rules) ? body.rules.map(String).filter(Boolean) : [],
    benefits: Array.isArray(body.benefits) ? body.benefits.map(String).filter(Boolean) : [],
    rewards: Array.isArray(body.rewards) ? body.rewards.map(String).filter(Boolean) : [],
    levels,
    redeemables,
  };

  let err;
  // Compatibilidade: se a migration 0052 (coluna `redeemables`) ainda não foi
  // aplicada no banco, salva sem ela em vez de quebrar (o catálogo volta
  // a funcionar sozinho após a migration, sem perder o resto).
  const savePayload = async (p: Record<string, unknown>) => {
    if (data) return (await admin.from("crm_loyalty_settings").update(p).eq("tenant_id", tenant!.id)).error;
    return (await admin.from("crm_loyalty_settings").insert({ tenant_id: tenant!.id, ...p })).error;
  };
  err = await savePayload(payload);
  if (err && /redeemables/i.test(err.message || "")) {
    const { redeemables: _dropped, ...withoutRedeemables } = payload;
    err = await savePayload(withoutRedeemables);
  }
  if (err) return NextResponse.json({ error: "Erro ao salvar configurações de fidelidade." }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_loyalty_update",
    entity_type: "crm_loyalty_settings",
    entity_id: tenant!.id,
    metadata: { enabled: payload.enabled },
  });
  return NextResponse.json({ success: true });
}