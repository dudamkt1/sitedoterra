import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getVercelDomain, removeVercelDomain } from "@/lib/vercel";

export const runtime = "nodejs";

/**
 * Ações do Super Admin sobre domínios:
 *  - verify: checa DNS na Vercel
 *  - block / unblock: bloqueia ou libera o domínio
 *  - unlink: desvincula o domínio do tenant (mantém o site)
 * PATCH /api/admin/domains/[id]  body: { action }
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const actorProfile = await getProfile(actor.id);
  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { action } = await request.json();
  const admin = createAdminClient();
  const { data: domainRow } = await admin.from("domains").select("*").eq("id", params.id).single();
  if (!domainRow) return NextResponse.json({ error: "Domínio não encontrado" }, { status: 404 });

  if (action === "verify") {
    await admin.from("domains").update({ status: "verifying", last_checked_at: new Date().toISOString() }).eq("id", domainRow.id);
    try {
      const info = await getVercelDomain(domainRow.domain.replace(/^www\./, ""));
      const verified = Boolean(info.verified);
      await admin.from("domains").update({
        status: verified ? "verified" : "error",
        verified_at: verified ? new Date().toISOString() : domainRow.verified_at,
        last_checked_at: new Date().toISOString(),
        error_message: verified ? null : "DNS ainda não detectado.",
      }).eq("id", domainRow.id);
    } catch {
      await admin.from("domains").update({ status: "error", error_message: "Erro ao consultar a Vercel." }).eq("id", domainRow.id);
    }
  } else if (action === "block") {
    await admin.from("domains").update({ status: "blocked" }).eq("id", domainRow.id);
  } else if (action === "unblock") {
    await admin.from("domains").update({ status: "verified" }).eq("id", domainRow.id);
  } else if (action === "unlink") {
    try {
      await removeVercelDomain(domainRow.domain.replace(/^www\./, ""));
    } catch {}
    await admin.from("domains").update({ status: "removed", removed_at: new Date().toISOString() }).eq("id", domainRow.id);
  } else {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  await admin.from("audit_logs").insert({
    actor_id: actor.id,
    actor_role: "superadmin",
    action: `domain.${action}`,
    entity_type: "domain",
    entity_id: domainRow.id,
    metadata: { domain: domainRow.domain },
  });

  return NextResponse.json({ success: true });
}
