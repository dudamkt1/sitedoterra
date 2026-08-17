import { NextResponse } from "next/server";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** GET /api/admin/crm/stats — uso global do CRM (somente agregados; nunca dados de clientes). */
export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const profile = await getProfile(actor.id);
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient();
  const [clientsRes, salesRes, financialRes, chargesRes, tasksRes, usersRes, tenantsRes] = await Promise.all([
    admin.from("crm_clients").select("tenant_id", { count: "exact", head: true }),
    admin.from("crm_sales").select("tenant_id", { count: "exact", head: true }),
    admin.from("crm_financial_entries").select("tenant_id", { count: "exact", head: true }),
    admin.from("crm_charges").select("tenant_id", { count: "exact", head: true }),
    admin.from("crm_tasks").select("tenant_id", { count: "exact", head: true }),
    admin.from("crm_clients").select("tenant_id"),
    admin.from("tenants").select("id"),
  ]);

  // Tenants com dados de CRM (que possuem pelo menos 1 cliente)
  const tenantSet = new Set((usersRes.data || []).map((r) => r.tenant_id));

  // Módulos ativos
  const { data: settings } = await admin.from("crm_settings").select("modules");
  const moduleCounts: Record<string, number> = {
    fidelidade: 0,
    financeiro: 0,
    cobrancas: 0,
    whatsapp: 0,
    automacoes: 0,
    relatorios: 0,
  };
  for (const s of settings || []) {
    const m = s.modules || {};
    for (const key of Object.keys(moduleCounts)) {
      if (m[key] !== false) moduleCounts[key] += 1;
    }
  }
  const { data: whatsapp } = await admin.from("crm_whatsapp_config").select("tenant_id").eq("enabled", true);
  const { data: loyalty } = await admin.from("crm_loyalty_settings").select("tenant_id").eq("enabled", true);

  return NextResponse.json({
    stats: {
      tenantsUsingCrm: tenantSet.size,
      totalTenants: (tenantsRes.data || []).length,
      clients: clientsRes.count || 0,
      sales: salesRes.count || 0,
      financialEntries: financialRes.count || 0,
      charges: chargesRes.count || 0,
      tasks: tasksRes.count || 0,
      whatsappEnabled: (whatsapp || []).length,
      loyaltyEnabled: (loyalty || []).length,
      modules: moduleCounts,
    },
  });
}