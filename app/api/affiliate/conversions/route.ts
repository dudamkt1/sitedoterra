import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { approveMaturedConversions } from "@/lib/affiliate";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Aprovação automática antes de listar (lista já vem atualizada).
  try {
    await approveMaturedConversions(user.id);
  } catch {}

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliate_conversions")
    .select("*")
    .eq("affiliate_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const conversions = (data || []) as Record<string, any>[];

  // Contexto de reembolso por conversão (para o painel explicar por que não
  // há saldo): status do pagamento mais recente do comprador indicado +
  // data da devolução, quando houver. Sem migration — leitura em lote.
  try {
    const customerIds = Array.from(
      new Set(conversions.map((c) => c.new_customer_user_id).filter(Boolean))
    ) as string[];
    if (customerIds.length > 0) {
      const { data: tenantRows } = await admin
        .from("tenants")
        .select("id, user_id")
        .in("user_id", customerIds);
      const tenantByUser: Record<string, string> = {};
      for (const t of ((tenantRows || []) as any[])) tenantByUser[t.user_id] = t.id;
      const tenantIds = Object.values(tenantByUser);
      let payByTenant: Record<string, { status: string; refunded_at: string | null }> = {};
      if (tenantIds.length > 0) {
        const { data: payRows } = await admin
          .from("payments")
          .select("tenant_id, status, metadata")
          .in("tenant_id", tenantIds)
          .in("type", ["activation", "subscription"])
          .order("created_at", { ascending: false });
        for (const p of ((payRows || []) as any[])) {
          if (!payByTenant[p.tenant_id]) {
            const meta = (p.metadata || {}) as Record<string, unknown>;
            payByTenant[p.tenant_id] = {
              status: p.status,
              refunded_at: typeof meta.refunded_at === "string" ? (meta.refunded_at as string) : null,
            };
          }
        }
      }
      for (const c of conversions) {
        const tid = tenantByUser[c.new_customer_user_id];
        c.refund_info = tid && payByTenant[tid] ? payByTenant[tid] : null;
      }
    }
  } catch {
    // Best-effort: sem contexto, a lista segue funcionando.
  }

  return NextResponse.json({ success: true, data: conversions });
}