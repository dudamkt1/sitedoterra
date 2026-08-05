import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { getVercelDomain } from "@/lib/vercel";

export const runtime = "nodejs";

/**
 * Verifica a configuração DNS/domínio na Vercel e atualiza o status.
 * GET /api/domains/[id]/verify
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const { data: domainRow } = await admin
    .from("domains")
    .select("*")
    .eq("id", params.id)
    .eq("tenant_id", tenant.id)
    .single();

  if (!domainRow) {
    return NextResponse.json({ error: "Domínio não encontrado" }, { status: 404 });
  }

  await admin.from("domains").update({ status: "verifying", last_checked_at: new Date().toISOString() }).eq("id", domainRow.id);

  let vercelInfo;
  try {
    vercelInfo = await getVercelDomain(domainRow.domain.startsWith("www.") ? domainRow.domain : domainRow.domain.replace(/^www\./, ""));
  } catch (err) {
    console.error("Falha ao consultar domínio na Vercel", err);
    await admin.from("domains").update({ status: "error", error_message: "Não foi possível consultar o domínio na infraestrutura." }).eq("id", domainRow.id);
    return NextResponse.json(
      { error: "Não foi possível verificar o domínio. Tente novamente em alguns minutos." },
      { status: 502 }
    );
  }

  const verified = Boolean(vercelInfo.verified);

  let status: "verified" | "error" = verified ? "verified" : "error";
  let message: string | null = null;

  if (!verified) {
    const checks = vercelInfo.verification || [];
    if (checks.length > 0) {
      message = `Ainda não detectamos a configuração correta de DNS (${checks.map((c) => `${c.type} ${c.value}`).join(", ")}). Verifique os registros e aguarde a propagação (pode levar de alguns minutos a 24h).`;
    } else {
      message = "A configuração DNS ainda não foi detectada. Confirme se os registros foram criados no painel do seu provedor de domínio e clique em verificar novamente.";
    }
  } else {
    message = null;
  }

  await admin.from("domains").update({
    status,
    verified_at: verified ? new Date().toISOString() : domainRow.verified_at,
    last_checked_at: new Date().toISOString(),
    error_message: message,
  }).eq("id", domainRow.id);

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "user",
    action: "domain.verified",
    entity_type: "domain",
    entity_id: domainRow.id,
    metadata: { verified, domain: domainRow.domain },
  });

  return NextResponse.json({ success: true, verified, status, message });
}
