import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** PUT /api/crm/products/[id] — atualiza produto. */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const payload: Record<string, unknown> = {};
  for (const k of ["name", "description", "category", "image_url", "active"] as const) {
    if (body[k] !== undefined) payload[k] = body[k];
  }
  if (body.price_cents !== undefined) payload.price_cents = Math.round(Number(body.price_cents) || 0);
  if (payload.name !== undefined && !String(payload.name).trim()) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }
  const { error: err } = await admin.from("crm_products").update(payload).eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao atualizar produto." }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE /api/crm/products/[id] — remove produto (itens de venda preservam o nome). */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const { error: err } = await admin.from("crm_products").delete().eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao excluir produto." }, { status: 500 });
  return NextResponse.json({ success: true });
}
