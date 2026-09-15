import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { effectiveSubscriptionStatus } from "@/lib/access";
import { slugify, isValidSlug } from "@/lib/utils";
import type { SubscriptionStatus } from "@/types";

export const runtime = "nodejs";

/**
 * Define o nome de usuário (slug) do tenant.
 * A URL pública passa a ser: {dominio}/{slug}
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { slug: rawSlug } = await request.json();
  const slug = slugify(String(rawSlug || ""));

  if (!isValidSlug(slug)) {
    return NextResponse.json(
      { error: "Nome de usuário inválido. Use 2-40 caracteres (letras, números e hífen), sem espaços ou caracteres especiais." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  // Verifica disponibilidade (excluindo o próprio usuário)
  const { data: available } = await admin.rpc("is_slug_available", {
    p_slug: slug,
    p_exclude_user_id: user.id,
  });

  if (!available) {
    return NextResponse.json({ error: "Este nome de usuário já está em uso. Escolha outro." }, { status: 409 });
  }

  // Usuário isento de mensalidade: site liberado sem exigir assinatura ativa.
  const { data: tenantRow } = await admin
    .from("tenants")
    .select("monthly_billing_enabled")
    .eq("id", tenant.id)
    .maybeSingle();
  const billingEnabled = tenantRow?.monthly_billing_enabled !== false;

  // REGRA DE OURO: trocar o nome de usuário NUNCA desativa um site com
  // ativação PAGA. A última atualização financeira manda: se for `succeeded`,
  // o site permanece/volta a `active` (espelho do domínio principal com a
  // URL própria) e a assinatura é curada quando necessário.
  const [{ data: sub }, { data: lastPay }, { data: currentTenant }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("status, trial_end")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("payments")
      .select("status, type")
      .eq("tenant_id", tenant.id)
      .in("type", ["activation", "subscription"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("tenants").select("site_status").eq("id", tenant.id).maybeSingle(),
  ]);

  const subActive = effectiveSubscriptionStatus(
    sub as { status: SubscriptionStatus; trial_end: string | null } | null
  ) === "active";
  const lastStatus = (lastPay as { status?: string } | null)?.status;
  const lastSucceeded = lastStatus === "succeeded";
  // Aguardando reembolso: o site segue no ar até o MP confirmar — a troca
  // de slug nunca desativa nesse intervalo.
  const lastAwaitingRefund = lastStatus === "refund_pending";
  const wasActive = (currentTenant as { site_status?: string } | null)?.site_status === "active";

  // Pagamento PAGO (ou aguardando reembolso) ou site já ativo: mantém ativo
  // (nunca rebaixa para pending). Só vai para pending quando NUNCA houve
  // pagamento e não há assinatura ativa.
  const siteStatus = !billingEnabled || subActive || lastSucceeded || lastAwaitingRefund || wasActive ? "active" : "pending";

  // Cura a assinatura quando há pagamento PAGO mas ela não está ativa
  // (ex.: linha antiga cancelada) — evita "Cancelada" + site fora do ar.
  // Nunca cura durante o fluxo de reembolso (pedido respeitado).
  if (lastSucceeded && !subActive) {
    try {
      const { ensureTenantActivated } = await import("@/lib/mp-payment-processor");
      await ensureTenantActivated(tenant.id);
    } catch {}
  }

  const { error } = await admin
    .from("tenants")
    .update({ slug, site_status: siteStatus, activated_at: siteStatus === "active" ? new Date().toISOString() : undefined })
    .eq("id", tenant.id);

  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar o nome de usuário." }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "user",
    action: "tenant.slug_updated",
    entity_type: "tenant",
    entity_id: tenant.id,
    metadata: { slug },
  });

  return NextResponse.json({ success: true, slug });
}
