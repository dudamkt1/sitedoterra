import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";
import { getCrmSettings, attachClientMetrics, getLoyaltySettings } from "@/lib/crm";
import { getProfile } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/crm/export — retorna o pacote completo de dados do CRM do usuário
 * (somente do tenant logado) para gerar PDF/CSV no client. Nenhum dado sensível
 * além do próprio consultor é incluído.
 */
export async function POST(request: Request) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const format = body.format === "csv" ? "csv" : "pdf";
  const exportType = typeof body.export_type === "string" ? body.export_type : "completo";

  const [profile, settings, [{ data: clients }, { data: products }, { data: sales }, { data: financial }, { data: charges }, { data: tasks }, { data: points }]] =
    await Promise.all([
      getProfile(user!.id),
      getCrmSettings(admin, tenant!.id),
      (async () => {
        const c = await admin.from("crm_clients").select("*").eq("tenant_id", tenant!.id).limit(2000);
        const p = await admin.from("crm_products").select("*").eq("tenant_id", tenant!.id).limit(2000);
        const s = await admin.from("crm_sales").select("*").eq("tenant_id", tenant!.id).limit(5000);
        const f = await admin.from("crm_financial_entries").select("*").eq("tenant_id", tenant!.id).limit(5000);
        const ch = await admin.from("crm_charges").select("*").eq("tenant_id", tenant!.id).limit(5000);
        const t = await admin.from("crm_tasks").select("*").eq("tenant_id", tenant!.id).limit(2000);
        const po = await admin.from("crm_loyalty_points").select("*").eq("tenant_id", tenant!.id).limit(5000);
        return [c, p, s, f, ch, t, po];
      })(),
    ]);

  const clientsRows = await attachClientMetrics(admin, tenant!.id, (clients || []) as any);

  // Nomes dos clientes nas vendas para o relatório
  const nameById = new Map(clientsRows.map((c) => [c.id, c.name]));
  const salesRows = (sales || []).map((s) => ({ ...s, client_name: s.client_id ? nameById.get(s.client_id) || null : null }));

  await admin.from("crm_export_logs").insert({
    tenant_id: tenant!.id,
    user_id: user!.id,
    export_type: exportType,
    format,
    period_start: body.from || null,
    period_end: body.to || null,
  });

  return NextResponse.json({
    bundle: {
      exported_at: new Date().toISOString(),
      consultant_name: profile?.name || null,
      site_name: tenant!.site_name,
      currency: settings.currency,
      clients: clientsRows,
      products: products || [],
      sales: salesRows,
      financial: financial || [],
      charges: charges || [],
      tasks: tasks || [],
      loyaltyPoints: points || [],
      loyaltySettings: await getLoyaltySettings(admin, tenant!.id),
    },
  });
}