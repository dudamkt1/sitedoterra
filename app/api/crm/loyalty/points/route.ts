import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** POST /api/crm/loyalty/points — adiciona/ajusta pontos manualmente (com auditoria). */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const amount = Math.round(Number(body.amount) || 0);
  if (!clientId) return NextResponse.json({ error: "Cliente não informado." }, { status: 400 });
  if (amount === 0) return NextResponse.json({ error: "Informe uma quantidade de pontos." }, { status: 400 });

  const { data: client } = await admin.from("crm_clients").select("name").eq("id", clientId).eq("tenant_id", tenant!.id).maybeSingle();
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 400 });

  const type = typeof body.type === "string" && body.type ? String(body.type) : "ajuste";
  const { data, error: err } = await admin
    .from("crm_loyalty_points")
    .insert({
      tenant_id: tenant!.id,
      client_id: clientId,
      amount,
      type,
      description: body.description || (type === "ajuste" ? "Ajuste manual pelo consultor" : null),
    })
    .select()
    .single();
  if (err) return NextResponse.json({ error: "Erro ao registrar pontos." }, { status: 500 });

  await admin.from("crm_client_timeline").insert({
    tenant_id: tenant!.id,
    client_id: clientId,
    event_type: "beneficio",
    title: `${amount > 0 ? "+" : ""}${amount} pontos de fidelidade`,
    description: body.description || "Ajuste manual pelo consultor",
    event_at: new Date().toISOString(),
  });

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_loyalty_points_adjust",
    entity_type: "crm_loyalty_points",
    entity_id: data.id,
    metadata: { client_id: clientId, client_name: client.name, amount, type },
  });
  return NextResponse.json({ success: true, point: data });
}