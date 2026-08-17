import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { getLoyaltySettings } from "@/lib/crm";

export const runtime = "nodejs";

/** GET /api/crm/loyalty — configurações + clientes com saldo e nível. */
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

  const levels = [...settings.levels].sort((a, b) => a.min_points - b.min_points);
  const clientRows = (clients || [])
    .map((c) => {
      const pts = balance.get(c.id) || 0;
      let level = levels[0]?.name || "Bronze";
      for (const l of levels) if (pts >= l.min_points) level = l.name;
      return { id: c.id, name: c.name, category: c.category, is_vip: c.is_vip, points: pts, level };
    })
    .sort((a, b) => b.points - a.points);

  return NextResponse.json({ settings, clients: clientRows });
}

/** PUT /api/crm/loyalty — salva configurações do programa. */
export async function PUT(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const { data } = await admin.from("crm_loyalty_settings").select("tenant_id").eq("tenant_id", tenant!.id).maybeSingle();

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
    levels: Array.isArray(body.levels) && body.levels.length ? body.levels : [],
  };

  let err;
  if (data) {
    ({ error: err } = await admin.from("crm_loyalty_settings").update(payload).eq("tenant_id", tenant!.id));
  } else {
    ({ error: err } = await admin.from("crm_loyalty_settings").insert({ tenant_id: tenant!.id, ...payload }));
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