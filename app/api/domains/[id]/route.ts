import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { removeVercelDomain } from "@/lib/vercel";

export const runtime = "nodejs";

/**
 * Remove/desvincula o domínio personalizado.
 * O site e a URL padrão continuam intactos.
 */
export async function DELETE(
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

  // Remove da Vercel
  try {
    await removeVercelDomain(domainRow.domain.startsWith("www.") ? domainRow.domain : domainRow.domain.replace(/^www\./, ""));
  } catch (err) {
    console.error("Falha ao remover domínio da Vercel", err);
    // Continua com a desvinculação local mesmo se a Vercel falhar
  }

  await admin.from("domains").update({
    status: "removed",
    removed_at: new Date().toISOString(),
  }).eq("id", domainRow.id);

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "user",
    action: "domain.removed",
    entity_type: "domain",
    entity_id: domainRow.id,
    metadata: { domain: domainRow.domain },
  });

  return NextResponse.json({ success: true });
}
