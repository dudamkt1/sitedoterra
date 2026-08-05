import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/onboarding";
import { isValidDomain, normalizeDomain, isApexDomain, domainBase } from "@/lib/utils";
import { addVercelDomain, buildDnsInstructions, getVercelDomain } from "@/lib/vercel";

export const runtime = "nodejs";

/**
 * Conecta um domínio personalizado ao site do tenant.
 * Validações: formato, reservado, já cadastrado em outro tenant.
 * Fluxo: adiciona na Vercel + registra no banco + retorna instruções DNS.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { domain: rawDomain } = await request.json();
  const domain = normalizeDomain(String(rawDomain || ""));

  if (!isValidDomain(domain)) {
    return NextResponse.json(
      { error: "Domínio inválido. Informe um domínio como meusite.com.br ou www.meusite.com.br." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const tenant = await ensureTenantForUser(user.id);
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });

  const base = domainBase(domain);

  // Domínio principal da plataforma
  const mainDomain = (process.env.NEXT_PUBLIC_APP_URL || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^www\./, "");
  if (mainDomain && base === mainDomain) {
    return NextResponse.json({ error: "Este domínio pertence à plataforma e não pode ser utilizado." }, { status: 409 });
  }

  // Já cadastrado (em qualquer tenant, ativo)
  const { data: existing } = await admin
    .from("domains")
    .select("*")
    .eq("domain", domain)
    .not("status", "in", ["removed"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Este domínio já está vinculado a outro site. Se for seu, entre em contato com o suporte." },
      { status: 409 }
    );
  }

  // Registra na Vercel (usa o domínio base; www é tratado como subdomínio pela Vercel)
  const vercelDomain = domain.startsWith("www.") ? domain : base;
  let vercelInfo;
  try {
    vercelInfo = await addVercelDomain(vercelDomain);
  } catch (err) {
    console.error("Falha ao adicionar domínio na Vercel", err);
    return NextResponse.json(
      { error: "Não foi possível registrar o domínio na infraestrutura. Verifique se o domínio é válido e tente novamente." },
      { status: 502 }
    );
  }

  // Insere no banco
  const { data: domainRow, error: insertError } = await admin
    .from("domains")
    .insert({
      tenant_id: tenant.id,
      domain,
      is_apex: isApexDomain(domain),
      vercel_domain_id: vercelInfo.apexName || domain,
      status: "pending",
      connected_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) {
    // Rollback na Vercel para não deixar domínio órfão
    try {
      const { removeVercelDomain } = await import("@/lib/vercel");
      await removeVercelDomain(vercelDomain);
    } catch {}
    return NextResponse.json({ error: "Não foi possível registrar o domínio." }, { status: 500 });
  }

  const instructions = buildDnsInstructions(domain, domainRow.is_apex, vercelInfo);

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "user",
    action: "domain.connected",
    entity_type: "domain",
    entity_id: domainRow.id,
    metadata: { domain },
  });

  return NextResponse.json({ success: true, domain: domainRow, instructions });
}
