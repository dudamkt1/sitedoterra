import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** DELETE /api/crm/messages/[id] — remove mensagem pronta. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const { error: err } = await admin.from("crm_message_templates").delete().eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao excluir mensagem." }, { status: 500 });
  return NextResponse.json({ success: true });
}