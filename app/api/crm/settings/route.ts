import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { getCrmSettings, upsertCrmSettings, getLoyaltySettings, getWhatsAppConfig, applyVipRules } from "@/lib/crm";
import { getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/crm/settings — retorna configurações, fidelidade e whatsapp (mascarado). */
export async function GET() {
  const { error, admin, tenant } = await requireTenant();
  if (error) return error;
  const [settings, loyalty, whatsapp] = await Promise.all([
    getCrmSettings(admin, tenant!.id),
    getLoyaltySettings(admin, tenant!.id),
    getWhatsAppConfig(admin, tenant!.id),
  ]);
  return NextResponse.json({ settings, loyalty, whatsapp });
}

/** PUT /api/crm/settings — salva configurações e regras de VIP. */
export async function PUT(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();

  const patch: Record<string, unknown> = {};
  if (body.currency && typeof body.currency === "string") patch.currency = String(body.currency).slice(0, 10);
  if (body.modules && typeof body.modules === "object") patch.modules = body.modules;
  if (body.categories && Array.isArray(body.categories)) patch.categories = body.categories.map(String).filter(Boolean).slice(0, 30);
  if (body.financial_categories && typeof body.financial_categories === "object") patch.financial_categories = body.financial_categories;
  if (body.vip_rules && typeof body.vip_rules === "object") {
    const r = body.vip_rules;
    patch.vip_rules = {
      minSpentCents: Math.round(Number(r.minSpentCents) || 0),
      minPurchases: Math.round(Number(r.minPurchases) || 0),
      minPoints: Math.round(Number(r.minPoints) || 0),
      reorderMonths: Math.round(Number(r.reorderMonths) || 0),
    };
  }

  const { error: err } = await upsertCrmSettings(admin, tenant!.id, patch);
  if (err) return NextResponse.json({ error: "Erro ao salvar configurações." }, { status: 500 });

  if (body.apply_vip === true) {
    const settings = await getCrmSettings(admin, tenant!.id);
    await applyVipRules(admin, tenant!.id, settings);
  }

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_settings_update",
    entity_type: "crm_settings",
    entity_id: tenant!.id,
    metadata: {},
  });

  return NextResponse.json({ success: true });
}
