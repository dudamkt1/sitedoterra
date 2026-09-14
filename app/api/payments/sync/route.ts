import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMpPayment,
  isMercadoPagoEnabled,
  searchMpPaymentsByExternalReference,
} from "@/lib/mercadopago";
import { dispatchMpPayment } from "@/lib/mp-payment-processor";

export const runtime = "nodejs";

/**
 * POST /api/payments/sync — conciliação manual dos pagamentos do usuário
 * logado direto no Mercado Pago (fonte de verdade).
 *
 * Quando o webhook não foi entregue/processado (URL inacessível, 401 de
 * assinatura, timeout), o usuário clica em "Verificar pagamento" e este
 * endpoint:
 *   1. busca no MP os pagamentos de `act_<tenantId>` e `mon_<tenantId>`;
 *   2. reconsulta cada um na API;
 *   3. aplica a MESMA máquina de estados do webhook
 *      (`dispatchMpPayment` — aprovado ativa, recusado falha, reembolsado
 *      desativa, pendente aguarda).
 *
 * Escopo estrito: somente o tenant do usuário autenticado. Nunca confia em
 * valores do frontend. Idempotente (pode ser chamado várias vezes).
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!(await isMercadoPagoEnabled())) {
    return NextResponse.json({ error: "Mercado Pago não configurado" }, { status: 503 });
  }

  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });
  }

  const admin = createAdminClient();
  const refs = [`act_${tenant.id}`, `mon_${tenant.id}`];
  const seen = new Set<string>();
  let checked = 0;
  let lastStatus: string | null = null;

  for (const ref of refs) {
    let results;
    try {
      results = await searchMpPaymentsByExternalReference(ref, 5);
    } catch (e) {
      console.error("[payments/sync] falha na busca do MP", ref, e);
      return NextResponse.json(
        { error: "Não foi possível consultar o Mercado Pago agora. Tente novamente em instantes." },
        { status: 502 }
      );
    }
    for (const item of results) {
      const pid = String(item.id);
      if (seen.has(pid)) continue;
      seen.add(pid);
      try {
        const payment = await getMpPayment(pid);
        const { status } = await dispatchMpPayment(payment);
        checked += 1;
        lastStatus = status;
      } catch (e) {
        console.error("[payments/sync] falha ao processar pagamento", pid, e);
      }
    }
  }

  // Estado atual (para o frontend decidir se recarrega).
  const [{ data: payment }, { data: site }] = await Promise.all([
    admin
      .from("payments")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("type", "activation")
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("tenants").select("site_status").eq("id", tenant.id).maybeSingle(),
  ]);

  const activated =
    (site as { site_status?: string } | null)?.site_status === "active" && Boolean(payment);

  return NextResponse.json({
    ok: true,
    checked,
    lastStatus,
    activated,
    hasActivationPayment: Boolean(payment),
    site_status: (site as { site_status?: string } | null)?.site_status || null,
  });
}
