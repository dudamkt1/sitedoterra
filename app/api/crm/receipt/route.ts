import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { blockIfDemo } from "@/lib/demo/auth";

export const runtime = "nodejs";

/**
 * Configuração do recibo de pagamento (por tenant).
 * Armazenada em site_settings.data.receipt — reutiliza a infra existente,
 * sem nova tabela/migração. Isolamento por tenant via requireTenant().
 */

export interface ReceiptConfig {
  businessName: string;
  doc: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
  primaryColor: string;
  footerText: string;
}

const DEFAULT_FOOTER = "Este recibo confirma o recebimento do valor informado acima.";

function sanitizeConfig(raw: unknown): ReceiptConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const colorRaw = str(r.primaryColor, 20);
  const primaryColor = /^#([0-9a-f]{6})$/i.test(colorRaw) ? colorRaw.toLowerCase() : "#1d5c3a";
  return {
    businessName: str(r.businessName, 120),
    doc: str(r.doc, 30),
    phone: str(r.phone, 40),
    email: str(r.email, 120),
    address: str(r.address, 250),
    logoUrl: str(r.logoUrl, 2000),
    primaryColor,
    footerText: str(r.footerText, 500) || DEFAULT_FOOTER,
  };
}

/** GET /api/crm/receipt — lê config + sugestões (nome/site do tenant). */
export async function GET() {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;

  const [{ data: settings }, { data: profile }] = await Promise.all([
    admin.from("site_settings").select("data").eq("tenant_id", tenant!.id).maybeSingle(),
    admin.from("profiles").select("name, email").eq("user_id", user!.id).maybeSingle(),
  ]);

  const data = (settings?.data || {}) as Record<string, unknown>;
  const config = sanitizeConfig(data.receipt);
  // Se nunca configurado, pré-preenche nome/contato com dados reais do tenant.
  if (!data.receipt) {
    if (!config.businessName) {
      const p = profile as { name?: string | null } | null;
      config.businessName = (data.fullName as string) || (data.name as string) || p?.name || "";
    }
    if (!config.phone) config.phone = (data.whatsapp as string) || "";
    if (!config.email) {
      const p = profile as { email?: string | null } | null;
      config.email = (data.email as string) || p?.email || "";
    }
  }

  return NextResponse.json({ success: true, config });
}

/** PUT /api/crm/receipt — salva config (merge em site_settings.data). */
export async function PUT(request: Request) {
  const demoBlock = await blockIfDemo();
  if (demoBlock) return demoBlock.response;

  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const config = sanitizeConfig(body);

  const { data: existing } = await admin
    .from("site_settings")
    .select("data")
    .eq("tenant_id", tenant!.id)
    .maybeSingle();
  const merged = { ...((existing?.data || {}) as Record<string, unknown>), receipt: config };

  const { error: upErr } = await admin
    .from("site_settings")
    .upsert({ tenant_id: tenant!.id, data: merged }, { onConflict: "tenant_id" });
  if (upErr) return NextResponse.json({ error: "Não foi possível salvar as configurações." }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_receipt_config_update",
    entity_type: "site_settings",
    entity_id: tenant!.id,
    metadata: {},
  });

  return NextResponse.json({ success: true, config });
}
