import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** GET /api/crm/catalog-payment — obtém configurações de pagamento do catálogo. */
export async function GET() {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;

  const { data, error: err } = await admin
    .from("catalog_payment_settings")
    .select("*")
    .eq("tenant_id", tenant!.id)
    .maybeSingle();

  if (err) return NextResponse.json({ error: "Erro ao buscar configurações." }, { status: 500 });

  // Se não existir, retorna configurações padrão
  const settings = data || {
    pix_enabled: true,
    pix_discount_percent: 0,
    pix_key: null,
    pix_key_type: null,
    pix_merchant_name: null,
    pix_merchant_city: null,
    mp_enabled: false,
    mp_installments: 1,
    mp_installments_without_interest: false,
    mp_access_token: null,
    mp_public_key: null,
    requires_contact_info: true,
  };

  return NextResponse.json({ settings });
}

/** POST /api/crm/catalog-payment — cria/atualiza configurações de pagamento do catálogo. */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;

  const body = await request.json();

  const settings = {
    tenant_id: tenant!.id,
    pix_enabled: body.pix_enabled !== false,
    pix_discount_percent: Math.max(0, Math.min(50, Number(body.pix_discount_percent) || 0)),
    pix_key: body.pix_key?.trim() || null,
    pix_key_type: body.pix_key_type || null,
    pix_merchant_name: body.pix_merchant_name?.trim() || null,
    pix_merchant_city: body.pix_merchant_city?.trim() || null,
    mp_enabled: body.mp_enabled === true,
    mp_installments: Math.max(1, Math.min(12, Number(body.mp_installments) || 1)),
    mp_installments_without_interest: body.mp_installments_without_interest === true,
    mp_access_token: typeof body.mp_access_token === "string" && body.mp_access_token.trim() ? body.mp_access_token.trim() : null,
    mp_public_key: typeof body.mp_public_key === "string" && body.mp_public_key.trim() ? body.mp_public_key.trim() : null,
    requires_contact_info: body.requires_contact_info !== false,
    updated_at: new Date().toISOString(),
  };

  const { data, error: err } = await admin
    .from("catalog_payment_settings")
    .upsert(settings, { onConflict: "tenant_id" })
    .select()
    .single();

  if (err) {
    console.error("[catalog-payment] erro ao salvar:", err);
    return NextResponse.json({ error: err.message || "Erro ao salvar configurações." }, { status: 500 });
  }

  return NextResponse.json({ success: true, settings: data });
}