import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { getWhatsAppConfig } from "@/lib/crm";
import { encryptSecret } from "@/lib/crypto";

export const runtime = "nodejs";

/** GET /api/crm/whatsapp — configuração (token sempre mascarado). */
export async function GET() {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const config = await getWhatsAppConfig(admin, tenant!.id);
  return NextResponse.json({ config });
}

/** PUT /api/crm/whatsapp — salva configuração; token é criptografado no servidor. */
export async function PUT(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();

  const payload: Record<string, unknown> = {
    enabled: body.enabled !== false,
  };
  for (const k of ["provider", "api_url", "phone_id", "webhook_url"] as const) {
    if (body[k] !== undefined) payload[k] = body[k] === "" ? null : String(body[k]);
  }
  if (body.access_token !== undefined && body.access_token !== "") {
    payload.access_token_enc = encryptSecret(String(body.access_token).trim());
  }

  const { data } = await admin.from("crm_whatsapp_config").select("tenant_id").eq("tenant_id", tenant!.id).maybeSingle();
  let err;
  if (data) {
    ({ error: err } = await admin.from("crm_whatsapp_config").update(payload).eq("tenant_id", tenant!.id));
  } else {
    ({ error: err } = await admin.from("crm_whatsapp_config").insert({ tenant_id: tenant!.id, ...payload }));
  }
  if (err) return NextResponse.json({ error: "Erro ao salvar configuração do WhatsApp." }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_whatsapp_update",
    entity_type: "crm_whatsapp_config",
    entity_id: tenant!.id,
    metadata: { has_token: body.access_token !== undefined && body.access_token !== "" },
  });

  const config = await getWhatsAppConfig(admin, tenant!.id);
  return NextResponse.json({ success: true, config });
}