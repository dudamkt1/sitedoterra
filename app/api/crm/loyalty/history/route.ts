import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/**
 * GET /api/crm/loyalty/history?client_id=...
 * Histórico de pontos de UM cliente (mais antigo → mais recente),
 * com saldo acumulado após cada movimentação.
 */
export async function GET(request: Request) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id") || "";
  if (!clientId) return NextResponse.json({ error: "Cliente não informado." }, { status: 400 });

  const { data: client } = await admin
    .from("crm_clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("tenant_id", tenant!.id)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const { data: rows } = await admin
    .from("crm_loyalty_points")
    .select("id, amount, type, description, created_at")
    .eq("tenant_id", tenant!.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(1000);

  let balance = 0;
  const history = (rows || []).map((r) => {
    balance += r.amount || 0;
    return { ...r, balance_after: balance };
  });

  return NextResponse.json({ client, history, balance });
}
